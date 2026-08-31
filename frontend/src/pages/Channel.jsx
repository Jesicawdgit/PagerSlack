import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as channelApi from '../api/channelApi';
import * as messageApi from '../api/messageApi';
import { useSocket } from '../hooks/useSocket';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

export default function Channel() {
  const { channelId } = useParams();
  const socket = useSocket();
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    channelApi.getChannel(channelId).then((res) => {
      if (!cancelled) setChannel(res.data.data.channel);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    messageApi.listMessages(channelId).then((res) => {
      if (!cancelled) setMessages(res.data.data.messages);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useEffect(() => {
    if (!socket) return undefined;

    function joinChannel() {
      socket.emit('channel:join', channelId);
    }
    function handleNewMessage(message) {
      if (message.channel === channelId) {
        setMessages((prev) => [...prev, message]);
      }
    }

    joinChannel();
    socket.on('connect', joinChannel);
    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('connect', joinChannel);
      socket.off('message:new', handleNewMessage);
      socket.emit('channel:leave', channelId);
    };
  }, [socket, channelId]);

  function handleSend(content) {
    messageApi.createMessage(channelId, content);
  }

  if (!channel) return null;

  return (
    <div className="d-flex flex-column h-100">
      <h2 className="h5 p-3 mb-0 border-bottom"># {channel.name}</h2>
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
