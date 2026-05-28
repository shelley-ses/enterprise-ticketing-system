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
  // Disable polling when using deferred refresh (only listen to websocket events)
  const effectiveIntervalMs = deferRefresh ? 0 : intervalMs;
  const refreshRef = useRef(refresh);
  const channelsRef = useRef(channels);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    if (!enabled || !tokenStore.getToken()) return undefined;

    const subscriptions = channelsRef.current.map(({ name, event }) => {
      const channel = echo.channel(name);
      const eventName = event.startsWith('.') ? event : `.${event}`;
      
      const handler = (payload) => {
        const context = { forceRefresh: true, source: 'websocket', payload };

        if (typeof shouldRefresh === 'function' && !shouldRefresh(context)) {
          onRefreshAvailable?.(context);
          return;
        }

        if (deferRefresh) {
          onRefreshAvailable?.(context);
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

          if (typeof shouldRefresh === 'function' && !shouldRefresh(context)) {
            onRefreshAvailable?.(context);
            return;
          }

          if (deferRefresh) {
            onRefreshAvailable?.(context);
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
