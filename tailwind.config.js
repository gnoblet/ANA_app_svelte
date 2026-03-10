/** @type {import('tailwindcss').Config} */
export default {
	plugins: [require('daisyui')],
	daisyui: {
		themes: ['light', 'dark'],
		darkMode: 'class',
		base: true,
		styled: true,
		utils: true,
		prefix: '',
		logs: true,
		themeRoot: ':root',
	},
};
