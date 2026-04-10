import { browser } from '$app/environment';

const STORAGE_KEY = 'ana-theme';
type Theme = 'ana-light' | 'ana-dark';

function getInitialTheme(): Theme {
	if (!browser) return 'ana-light';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'ana-light' ? 'ana-light' : 'ana-dark';
}

let _theme = $state<Theme>(getInitialTheme());

export const themeStore = {
	get theme(): Theme {
		return _theme;
	},
	get isDark(): boolean {
		return _theme === 'ana-dark';
	},
	toggle() {
		_theme = _theme === 'ana-light' ? 'ana-dark' : 'ana-light';
		if (browser) {
			localStorage.setItem(STORAGE_KEY, _theme);
			document.documentElement.setAttribute('data-theme', _theme);
		}
	}
};
