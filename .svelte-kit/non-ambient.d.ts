
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/client-stream" | "/api/config" | "/api/refresh" | "/api/scoreboard" | "/api/status" | "/config" | "/database" | "/favicon.png" | "/robots.txt" | "/[scoreboard]";
		RouteParams(): {
			"/[scoreboard]": { scoreboard: string }
		};
		LayoutParams(): {
			"/": { scoreboard?: string };
			"/api": Record<string, never>;
			"/api/client-stream": Record<string, never>;
			"/api/config": Record<string, never>;
			"/api/refresh": Record<string, never>;
			"/api/scoreboard": Record<string, never>;
			"/api/status": Record<string, never>;
			"/config": Record<string, never>;
			"/database": Record<string, never>;
			"/favicon.png": Record<string, never>;
			"/robots.txt": Record<string, never>;
			"/[scoreboard]": { scoreboard: string }
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/client-stream" | "/api/client-stream/" | "/api/config" | "/api/config/" | "/api/refresh" | "/api/refresh/" | "/api/scoreboard" | "/api/scoreboard/" | "/api/status" | "/api/status/" | "/config" | "/config/" | "/database" | "/database/" | "/favicon.png" | "/favicon.png/" | "/robots.txt" | "/robots.txt/" | `/${string}` & {} | `/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}