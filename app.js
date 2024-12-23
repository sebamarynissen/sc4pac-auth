import { BrowserWindow, app, session, dialog } from 'electron/main';
import setCookie from 'set-cookie-parser';

const url = 'https://community.simtropolis.com';
app.on('ready', async () => {

	let cookie = await getCookie();
	if (cookie) {
		await dialog.showMessageBox(null, {
			message: `Cookie is: ${cookie}`,
		});
		app.quit();
	}

	// If we reach this point, then we'll have to ask the user to login to Simtropolis.
	const filter = {
		urls: ['https://community.simtropolis.com/*'],
	};
	session.defaultSession.webRequest.onHeadersReceived(filter, async (details, cb) => {
		let headers = details.responseHeaders;
		let cookies = headers['set-cookie'] || [];
		for (let raw of cookies) {
			let [parsed] = setCookie.parse(raw);
			session.defaultSession.cookies.set({
				url,
				name: parsed.name,
				value: parsed.value,
				domain: 'simtropolis.com',
				path: parsed.path,
				secure: parsed.secure,
				httpOnly: parsed.httpOnly,
				expirationDate: Math.floor(parsed.expires/1000),
			});
		}
		if (cookies.length > 0) {
			let cookie = await getCookie();
			if (cookie) {
				await dialog.showMessageBox(win, {
					message: `Cookie is: ${cookie}`,
				});
				app.quit();
			}
		}
		cb(null);

	});

	let win = new BrowserWindow({
		show: false,
		width: 1280,
		height: 920,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
	});
	win.once('ready-to-show', () => win.show());
	win.loadURL(url);

});

app.on('window-all-closed', () => app.quit());

async function getCookie() {
	let cookies = await session.defaultSession.cookies.get({ url });
	let deviceKey = findCookie(cookies, 'ips4_device_key');
	let memberId = findCookie(cookies, 'ips4_member_id');
	let loginKey = findCookie(cookies, 'ips4_login_key');
	if (deviceKey && memberId && loginKey) {
		return [
			`ips4_device_key=${deviceKey}`,
			`ips4_member_id=${memberId}`,
			`ips4_login_key=${loginKey}`,
		].join('; ');
	}
	return null;
}

function findCookie(cookies, name) {
	let cookie = cookies.find(cookie => cookie.name === name);
	if (!cookie) return null;
	let parsed = {
		...cookie,
		...cookie.expirationDate && {
			expirationDate: new Date(+cookie.expirationDate*1000),
		},
		[Symbol.toPrimitive]() {
			return this.value;
		}
	};

	// If the cookie is expiring in the near future, we treat it as non-existent.
	if (parsed.expirationDate) {
		if (parsed.expirationDate < Date.now() + 24*3600e3) return null;
	}
	return parsed;
}
