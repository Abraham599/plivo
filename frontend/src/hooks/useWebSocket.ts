import { useEffect, useRef } from 'react';

const WS_URL = `${import.meta.env.VITE_WS_URL}/ws`;

type ServiceEvent = {
  type:
    | 'service_created'
    | 'service_updated'
    | 'service_deleted'
    | 'incident_created'
    | 'incident_updated'
    | 'incident_deleted'
    | 'update_created';
  data: any;
};

export function useWebSocket(onEvent: (event: ServiceEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          [
            'service_created',
            'service_updated',
            'service_deleted',
            'incident_created',
            'incident_updated',
            'incident_deleted',
            'update_created',
          ].includes(data.type)
        ) {
          onEvent(data);
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [onEvent]);
} 