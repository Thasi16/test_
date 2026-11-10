"""Attach user-supplied MP4s to existing syllabus words; requires PyAV offline only."""

import argparse
import hashlib
import json
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parents[3]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(word):
    word = unicodedata.normalize('NFD', word.casefold().replace('đ', 'd'))
    return ''.join(c for c in word if unicodedata.category(c) != 'Mn').strip()


def import_videos(source, root=ROOT):
    import av  # Build-time dependency; never needed by the website.

    source = source.resolve()
    curriculum_path = root / 'data/curriculum.json'
    data = json.loads(curriculum_path.read_text(encoding='utf-8'))
    planned = []
    seen = set()
    for folder in sorted(source.iterdir()):
        if not folder.is_dir():
            continue
        files = sorted(folder.glob('*.mp4'))
        matches = [s for s in data['signs'] if s.get('lesson') is not None
                   and normalize(s['word']['vi']) == normalize(folder.name)]
        if len(files) != 1 or len(matches) != 1:
            raise ValueError(f'Expected one MP4 and one syllabus word: {folder.name}')
        sign = matches[0]
        if sign['slug'] in seen:
            raise ValueError(f'Duplicate word: {folder.name}')
        seen.add(sign['slug'])
        original = files[0]
        checksum = digest(original)
        if sign.get('video'):
            existing = root / sign['video'].lstrip('/')
            previous = sign.get('source', {})
            if (previous.get('sha256') != checksum or not existing.is_file()
                    or digest(existing) != previous.get('web_sha256')):
                raise ValueError(f'Refusing to replace different media: {sign["slug"]}')
            print('Reused existing video:', sign['slug'])
            continue
        destination = root / 'static/media/local-videos' / (sign['slug'] + '.mp4')
        if destination.exists():
            raise ValueError(f'Refusing to overwrite unregistered file: {destination}')
        planned.append((original, destination, sign, checksum))
    if not seen:
        raise ValueError('No video folders found')

    for original, destination, sign, checksum in planned:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix('.preparing')
        try:
            with av.open(str(original)) as incoming:
                video = incoming.streams.video[0]
                dimensions = (video.width, video.height)
                rate = video.average_rate
                with av.open(str(temporary), 'w', format='mp4',
                             options={'movflags': '+faststart'}) as outgoing:
                    stream = outgoing.add_stream('libx264', rate=rate)
                    stream.width, stream.height = dimensions
                    stream.pix_fmt = 'yuv420p'
                    stream.options = {'crf': '18', 'preset': 'fast'}
                    stream.codec_context.thread_count = 2
                    frames = 0
                    for frame in incoming.decode(video):
                        for packet in stream.encode(frame):
                            outgoing.mux(packet)
                        frames += 1
                    for packet in stream.encode():
                        outgoing.mux(packet)
            with av.open(str(temporary)) as prepared:
                video = prepared.streams.video[0]
                if (video.codec_context.name != 'h264'
                        or (video.width, video.height) != dimensions
                        or video.average_rate != rate
                        or sum(1 for _ in prepared.decode(video)) != frames):
                    raise ValueError(f'Video validation failed: {original}')
            if digest(original) != checksum:
                raise ValueError(f'Source changed during conversion: {original}')
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
        sign.update(video='/static/media/local-videos/' + destination.name,
                    collection='local-videos', status='sample')
        sign['source'] = {
            'directory': source.name,
            'relative_path': original.relative_to(source).as_posix(),
            'sha256': checksum,
            'web_sha256': digest(destination),
            'web_codec': 'h264',
        }
        print('Prepared H.264:', sign['slug'], frames, 'frames', flush=True)
    if planned:
        data['_local_videos']['note'] = (
            'User-supplied sample videos mapped by exact Vietnamese gloss to the '
            'syllabus. Original and web checksums record provenance; media remains unreviewed.'
        )
        curriculum_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Added {len(planned)} videos; reused {len(seen) - len(planned)} existing videos.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    import_videos(args.source)
