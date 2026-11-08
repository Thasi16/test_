"""Run from project root: python -B modules/account/tests/check_render.py."""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import app_modules
from i18n import DICTIONARIES, render_text


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class AccountChecks(unittest.TestCase):
    def test_independent_sidebar_module_contract(self):
        meta = json.loads((ROOT / 'modules/account/module.json').read_text(encoding='utf-8'))
        self.assertEqual('account', meta['id'])
        self.assertEqual('account.nav', meta['nav']['label_key'])
        self.assertEqual('user', meta['nav']['icon'])
        self.assertEqual('/app/account', meta['routes'][0]['path'])
        self.assertEqual('account', app_modules.match('/app/account')[0]['id'])
        self.assertNotIn('/app/account', [route['path'] for route in app_modules.BY_ID['settings']['routes']])

    def test_premium_page_in_both_languages(self):
        template = (ROOT / 'modules/account/page.html').read_text(encoding='utf-8')
        for locale in ('vi', 'en'):
            source = render_text(template, DICTIONARIES[locale])
            tags = Markup(source).tags
            self.assertEqual(1, sum(tag == 'h1' for tag, _ in tags))
            self.assertEqual(4, sum(attrs.get('class', '').startswith('sh-card account-plan') for _, attrs in tags))
            self.assertEqual(3, sum('data-plan-choice' in attrs for _, attrs in tags))
            self.assertEqual(1, sum(tag == 'button' and 'disabled' in attrs for tag, attrs in tags))
            self.assertIn('account-premium-frame', source)
            self.assertIn('PREMIUM', source)
            self.assertIn('data-account-logout', source)
            self.assertNotIn('{{account.', source)


if __name__ == '__main__':
    unittest.main()
