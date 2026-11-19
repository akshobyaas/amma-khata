import sys, asyncio
from playwright.async_api import async_playwright
async def main(url, out, actions):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
        await pg.goto(url); await pg.wait_for_timeout(1500)
        for a in actions:
            kind, arg = a.split('=', 1)
            if kind == 'click': await pg.click(arg)
            elif kind == 'eval': await pg.evaluate(arg)
            await pg.wait_for_timeout(400)
        await pg.screenshot(path=out, full_page=(len(sys.argv) > 3 and 'full' in sys.argv))
        print('\n'.join(logs))
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2], [a for a in sys.argv[3:] if a != 'full']))
