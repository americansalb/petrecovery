'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  AlertCircle,
  MapPin,
  Users,
  Megaphone,
  Check,
  ChevronRight
} from 'lucide-react';

const NOTIFICATION_ICONS = {
  CASE_UPDATE: { icon: AlertCircle, color: '#f59e0b', bg: '#fef3c7' },
  SIGHTING: { icon: MapPin, color: '#10b981', bg: '#d1fae5' },
  SQUAD_MESSAGE: { icon: Users, color: '#4f46e5', bg: '#e0e7ff' },
  SYSTEM: { icon: Megaphone, color: '#6b7280', bg: '#f3f4f6' },
  DEFAULT: { icon: Bell, color: '#64748b', bg: '#f1f5f9' }
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load unread count on mount and periodically
  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadCount();
      // Poll every 60 seconds
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=1');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=5');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' });
    }
    setIsOpen(false);
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return notifDate.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    const config = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.DEFAULT;
    const Icon = config.icon;
    return (
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: config.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={16} color={config.color} />
      </div>
    );
  };

  if (!session) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: isOpen ? '#e0e7ff' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
      >
        <Bell size={22} color={isOpen ? '#4f46e5' : '#64748b'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '380px',
          maxHeight: '500px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          zIndex: 100,
          border: '1px solid #e2e8f0'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              margin: 0
            }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span style={{
                padding: '0.25rem 0.5rem',
                background: '#e0e7ff',
                color: '#4f46e5',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Notifications List */}
          <div style={{
            maxHeight: '350px',
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#64748b'
              }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                padding: '3rem',
                textAlign: 'center'
              }}>
                <Bell size={32} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
                <p style={{ color: '#64748b', margin: 0 }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: notification.read ? 'white' : '#f8fafc',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                >
                  {getNotificationIcon(notification.type)}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem'
                    }}>
                      <h4 style={{
                        fontWeight: notification.read ? '500' : '600',
                        color: '#0f172a',
                        fontSize: '0.875rem',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {notification.title}
                      </h4>
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        flexShrink: 0
                      }}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p style={{
                      color: '#64748b',
                      fontSize: '0.8rem',
                      margin: '0.25rem 0 0 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {notification.message}
                    </p>

                    {!notification.read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          marginTop: '0.5rem',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={12} />
                        Mark read
                      </button>
                    )}
                  </div>

                  {!notification.read && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      flexShrink: 0,
                      marginTop: '0.25rem'
                    }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              borderTop: '1px solid #f1f5f9',
              color: '#4f46e5',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.875rem',
              background: '#fafbfc',
              transition: 'background 0.15s'
            }}
          >
            View all notifications
            <ChevronRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
