/**
 * The Turnstile widget as a standalone page, for native.
 *
 * Turnstile is a browser widget with no React Native binding, so the app loads
 * this page in a WebView (apps/mobile/src/components/turnstile.tsx) and reads
 * the token back over the WebView bridge. Serving it from the Worker is what
 * makes that work in production: Cloudflare checks the widget against the
 * hostnames registered for it, and this page shares an origin with the web app,
 * so the one registered widget covers both.
 */

export type TurnstileTheme = 'auto' | 'light' | 'dark';

/**
 * Escapes a value for an HTML attribute. The site key is configuration rather
 * than user input, but the page hands it to the widget through a data attribute
 * precisely so a stray quote can only ever be a broken attribute - never a way
 * into the script block.
 */
function attribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function turnstilePage(siteKey: string, theme: TurnstileTheme): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>Verification</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        /* The WebView is transparent, so the widget sits on the app's own
           background rather than a white card. */
        background: transparent;
      }
      #widget {
        min-height: 65px;
      }
    </style>
  </head>
  <body>
    <div id="widget" data-sitekey="${attribute(siteKey)}" data-theme="${attribute(theme)}"></div>
    <script>
      (function () {
        var widget = document.getElementById('widget');
        var widgetId = null;

        function post(token) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'turnstile', token: token }));
          }
        }

        // Named in the script URL below, and called once Turnstile has loaded.
        window.onTurnstileLoad = function () {
          widgetId = window.turnstile.render(widget, {
            sitekey: widget.dataset.sitekey,
            theme: widget.dataset.theme,
            size: 'flexible',
            callback: post,
            'error-callback': function () {
              post(null);
            },
            'expired-callback': function () {
              post(null);
            },
          });
        };

        // Tokens are single-use, so the app asks for a fresh one after a failed
        // submit. The native side calls this through injectJavaScript().
        window.turnstileReset = function () {
          post(null);
          if (widgetId !== null) window.turnstile.reset(widgetId);
        };

        var script = document.createElement('script');
        script.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
        script.async = true;
        // A blocked or failed load must not leave the app waiting for a token
        // that can never arrive.
        script.onerror = function () {
          post(null);
        };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>
`;
}
