"""Run from the project root: python -B modules/review/tests/check_render.py."""
import html
from html.parser import HTMLParser
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import app_modules
import content
from i18n import DICTIONARIES, render_text

VIEW = app_modules.BY_ID['review']['view']


def request(locale='en', identifier=None, **overrides):
    facade = SimpleNamespace(**{name: getattr(content, name) for name in ('lesson', 'signs', 'text', 'is_open', 'open_lessons')})
    for name, value in overrides.items():
        setattr(facade, name, value)
    return SimpleNamespace(locale=locale, params={} if identifier is None else {'id': identifier},
                           content=facade, t=DICTIONARIES[locale], NotFound=app_modules.NotFound,
                           esc=lambda value: html.escape(str(value), quote=True), url=lambda path: path + '?lang=' + locale)


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class ReviewChecks(unittest.TestCase):
    def test_locale_prefixes_and_markup(self):
        self.assertEqual({key for key in DICTIONARIES['vi'] if key.startswith('review.')},
                         {key for key in DICTIONARIES['en'] if key.startswith('review.')})
        for locale in ('vi', 'en'):
            for identifier in (None, 'video', '1', '9'):
                values = VIEW.context(request(locale, identifier))
                self.assertTrue(all(key.startswith('review.') for key in values))
                template = 'quiz.html' if identifier else 'page.html'
                source = render_text((ROOT / 'modules/review' / template).read_text(encoding='utf-8'),
                                     dict(DICTIONARIES[locale], **values), {key for key in values if key.endswith('.html')})
                tags = Markup(source).tags
                self.assertEqual(1, sum(tag == 'h1' for tag, _ in tags))
                self.assertFalse(any(tag == 'form' or 'style' in attrs or any(key.startswith('on') for key in attrs) for tag, attrs in tags))
                for tag, attrs in tags:
                    if tag == 'a':
                        self.assertIn('?lang=' + locale, attrs['href'])

    def test_review_landing_only_offers_video_multiple_choice(self):
        values = VIEW.context(request())
        self.assertEqual('/app/review/quiz/video?lang=en', values['review.video_quiz_url'])
        self.assertEqual(str(len([sign for sign in content.signs() if sign.get('video')])), values['review.video_count'])
        page = (ROOT / 'modules/review/page.html').read_text(encoding='utf-8')
        self.assertNotIn('data-flash', page)
        self.assertNotIn('review.lessons.html', page)

    def test_invalid_closed_and_small_lessons(self):
        for identifier in ('999', 'abc', '-1', ''):
            with self.subTest(identifier=identifier), self.assertRaises(app_modules.NotFound):
                VIEW.context(request(identifier=identifier))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(identifier='1', signs=lambda *_: content.signs(1)[:1]))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(signs=lambda *_: []))

    def test_untrusted_content_escaped(self):
        malicious = '<img src=x onerror="bad()"> & \'quoted\''
        lesson = dict(content.lesson(1), title={'vi': malicious, 'en': malicious})
        signs = [dict(sign, word={'vi': malicious, 'en': malicious}, meaning={'vi': malicious, 'en': malicious})
                 for sign in content.signs() if sign.get('video')]
        detail = VIEW.context(request(identifier='video', signs=lambda *_: signs))
        for value in (detail['review.reading.html'],):
            self.assertNotIn(malicious, value)
            self.assertIn(html.escape(malicious, quote=True), value)

    def test_no_js_reading_and_sample_metadata(self):
        values = VIEW.context(request(identifier='video'))
        for sign in content.signs():
            if not sign.get('video'):
                continue
            self.assertIn(content.text(sign['word'], 'en'), values['review.reading.html'])
            self.assertIn(sign['slug'], values['review.sample_slugs'].split(','))
        self.assertEqual('', values['review.sample.html'])
        self.assertNotIn('data-flash', (ROOT / 'modules/review/page.html').read_text(encoding='utf-8'))
        self.assertIn('<noscript>', (ROOT / 'modules/review/quiz.html').read_text(encoding='utf-8'))

    def test_vocabulary_only_lesson_does_not_become_a_global_quiz(self):
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(identifier='18'))


if __name__ == '__main__':
    unittest.main()
