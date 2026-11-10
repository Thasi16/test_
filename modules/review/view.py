"""Render video multiple-choice review, retaining valid lesson quiz links."""


def context(request):
    c, t, esc, locale = request.content, request.t, request.esc, request.locale
    sample_slugs = ','.join(sign['slug'] for sign in c.signs() if sign['status'] == 'sample')

    def sample(item):
        return ('<span class="sh-badge sh-badge--sample">' + esc(t['shell.badge.sample']) + '</span>'
                if item['status'] == 'sample' else '')

    lesson_id = request.params.get('id')
    if lesson_id is None:
        video_signs = [sign for sign in c.signs() if sign.get('video')]
        if len(video_signs) < 2:
            raise request.NotFound()
        return {
            'review.video_count': str(len(video_signs)),
            'review.video_quiz_url': request.url('/app/review/quiz/video'),
            'review.sample_slugs': sample_slugs,
        }
    requested_lesson = None
    if lesson_id != 'video':
        requested_lesson = c.lesson(lesson_id)
        if not requested_lesson or not c.is_open(requested_lesson) or len(c.signs(requested_lesson['id'])) < 2:
            raise request.NotFound()
    requested_video_signs = ([sign for sign in c.signs(requested_lesson['id']) if sign.get('video')]
                             if requested_lesson else [])
    if requested_lesson and len(requested_video_signs) < 2:
        raise request.NotFound()
    if lesson_id == 'video' or len(requested_video_signs) < 2:
        signs = [sign for sign in c.signs() if sign.get('video')]
        if len(signs) < 2:
            raise request.NotFound()
        reading = ''.join(
            f'<li><h3>{esc(c.text(sign["word"], locale))}</h3>{sample(sign)}'
            f'<p>{esc(c.text(sign["meaning"], locale))}</p></li>' for sign in signs)
        return {
            'review.heading': t['review.video_quiz.heading'],
            'review.lesson_title': t['review.video_quiz.lead'].replace('{n}', str(len(signs))),
            'review.lesson_id': 'video',
            'review.quiz_mode': 'video',
            'review.quiz.rule': t['review.video_quiz.rule'],
            'review.sample.html': '',
            'review.sample_slugs': sample_slugs,
            'review.reading.html': reading,
            'review.lesson_action.html': '',
            'review.courses_url': request.url('/app/courses'),
            'review.back_url': request.url('/app/review'),
        }
    lesson = requested_lesson
    if not lesson or not c.is_open(lesson) or len(c.signs(lesson['id'])) < 2:
        raise request.NotFound()
    signs = requested_video_signs
    reading = ''.join(
        f'<li><h3>{esc(c.text(sign["word"], locale))}</h3>{sample(sign)}'
        f'<p>{esc(c.text(sign["meaning"], locale))}</p></li>' for sign in signs)
    return {
        'review.heading': t['review.quiz.title'] + ' · ' + t['review.quiz.lesson'].replace('{n}', str(lesson['id'])),
        'review.lesson_title': c.text(lesson['title'], locale),
        'review.lesson_id': str(lesson['id']),
        'review.quiz_mode': 'lesson',
        'review.sample.html': sample(lesson),
        'review.sample_slugs': sample_slugs,
        'review.reading.html': reading,
        'review.lesson_url': request.url('/app/lessons/' + str(lesson['id'])),
        'review.lesson_action.html': f'<a class="button button-outline" href="{esc(request.url("/app/lessons/" + str(lesson["id"])))}">{esc(t["review.go.lesson"])}</a>',
        'review.courses_url': request.url('/app/courses'),
        'review.back_url': request.url('/app/review'),
    }
