import { useEffect, useRef } from 'react';
import echo from '@/services/echo';
import tokenStore from '@/auth/tokenStore';

export default function useRealtimeRefresh({
  refresh,
  channels = [],
  intervalMs = 30000,
  enabled = true,
  shouldRefresh,
  deferRefresh = false,
  onRefreshAvailable,
}) {
  const refreshRef = useRef(refresh);
  const channelsRef = useRef(channels);
  const shouldRefreshRef = useRef(shouldRefresh);
  const onRefreshAvailableRef = useRef(onRefreshAvailable);
  const deferRefreshRef = useRef(deferRefresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    shouldRefreshRef.current = shouldRefresh;
    onRefreshAvailableRef.current = onRefreshAvailable;
    deferRefreshRef.current = deferRefresh;
  }); // Keep dynamic callbacks fresh on every render

  useEffect(() => {
    if (!enabled || !tokenStore.getToken()) return undefined;

    // Disable polling when using deferred refresh (only listen to websocket events)
    const effectiveIntervalMs = deferRefreshRef.current ? 0 : intervalMs;

    const subscriptions = channelsRef.current.map(({ name, event }) => {
      const channel = echo.channel(name);
      const eventName = event.startsWith('.') ? event : `.${event}`;
      
      const handler = (payload) => {
        const context = { forceRefresh: true, source: 'websocket', payload };

        if (typeof shouldRefreshRef.current === 'function' && !shouldRefreshRef.current(context)) {
          onRefreshAvailableRef.current?.(context);
          return;
        }

        if (deferRefreshRef.current) {
          onRefreshAvailableRef.current?.(context);
          return;
        }

        refreshRef.current?.(context);
      };

      channel.listen(eventName, handler);
      return { channel, eventName };
    });

    const timer = effectiveIntervalMs
      ? setInterval(() => {
          const context = { forceRefresh: true, source: 'poll' };

          if (typeof shouldRefreshRef.current === 'function' && !shouldRefreshRef.current(context)) {
            onRefreshAvailableRef.current?.(context);
            return;
          }

          if (deferRefreshRef.current) {
            onRefreshAvailableRef.current?.(context);
            return;
          }

          refreshRef.current?.(context);
        }, effectiveIntervalMs)
      : null;

    return () => {
      if (timer) clearInterval(timer);
      subscriptions.forEach(({ channel, eventName }) => {
        if (channel?.stopListening) {
          channel.stopListening(eventName);
        }
      });
    };
  }, [enabled, intervalMs]);
}
