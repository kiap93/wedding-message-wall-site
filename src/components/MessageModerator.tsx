import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Check, X, Clock, AlertCircle } from 'lucide-react';
import { Message } from '../lib/api';
import { fetchMessages, updateMessageStatus } from '../lib/api';

interface MessageModeratorProps {
  projectId: string;
}

export default function MessageModerator({ projectId }: MessageModeratorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadMessages();
  }, [projectId, filter]);

  async function loadMessages() {
    setIsLoading(true);
    // Fetch all for current project
    const allMessages = await fetchMessages(projectId, true);
    // Filter client side based on selection
    setMessages(allMessages.filter(m => (m.status || 'pending') === filter));
    setIsLoading(false);
  }

  const handleStatusUpdate = async (messageId: string, status: 'approved' | 'rejected') => {
    try {
      await updateMessageStatus(messageId, status);
      // Optimistic update
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err) {
      alert('Failed to update message status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl w-fit">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === s 
                ? 'bg-white text-[#C5A059] shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-[#C5A059]/10 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-2xl font-serif">Message Queue</h3>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#C5A059] bg-[#C5A059]/10 px-3 py-1 rounded-full">
            {messages.length} {filter} messages
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-4">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto opacity-50">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="font-medium">No {filter} messages found.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div 
                key={msg.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#2D2424]">{msg.name}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed italic">"{msg.message}"</p>
                </div>

                <div className="flex items-center gap-3">
                  {filter !== 'approved' && (
                    <button
                      onClick={() => handleStatusUpdate(msg.id, 'approved')}
                      className="flex items-center gap-2 px-5 py-3 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  )}
                  {filter !== 'rejected' && (
                    <button
                      onClick={() => handleStatusUpdate(msg.id, 'rejected')}
                      className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
