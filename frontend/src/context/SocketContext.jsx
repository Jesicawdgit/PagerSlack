import { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

// eslint-disable-next-line react-refresh/only-export-components -- useSocket.js needs the raw context
export const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    const socketUrl = import.meta.env.VITE_SOCKET_URL;
    const conn = socketUrl ? io(socketUrl, { withCredentials: true }) : io({ withCredentials: true });
    function handleConnect() {
      setSocket(conn);
    }
    conn.on('connect', handleConnect);

    return () => {
      conn.off('connect', handleConnect);
      conn.disconnect();
      setSocket(null);
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
