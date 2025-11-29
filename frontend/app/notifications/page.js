'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  MapPin,
  MessageSquare,
  Users,
  Megaphone,
  ChevronDown,
  Trash2,
  RefreshCw
} from 'lucide-react';

const NOTIFICATION_ICONS = {
  CASE_UPDATE: { icon: AlertCircle, color: '#f59e0b', bg: '#fef3c7' },
  SIGHTING: { icon: MapPin, color: '#10b981', bg: '#d1fae5' },
  SQUAD_MESSAGE: { icon: Users, color: '#4f46e5', bg: '#e0e7ff' },
  SYSTEM: { icon: Megaphone, color: '#6b7280', bg: '#f3f4f6' },
  DEFAULT: { icon: Bell, color: '#64748b', bg: '#f1f5f9' }
};

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/notifications');
    } else if (status === 'authenticated') {
      loadNotifications();
    }
  }, [status, filter]);

  const loadNotifications = async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');

    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: offset.toString(),
      });
      if (filter === 'unread') {
        params.set('unread', 'true');
      }

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error('Failed to load notifications');

      const data = await res.json();

      if (offset === 0) {
        setNotifications(data.notifications);
      } else {
        setNotifications(prev => [...prev, ...data.notifications]);
      }
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark as read');

      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark all as read');

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete notification');

      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
      if (!notification?.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifDate.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    const config = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.DEFAULT;
    const Icon = config.icon;
    return (
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: config.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={20} color={config.color} />
      </div>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#4f46e5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#4f46e5',
                textDecoration: 'none',
                fontWeight: '600',
                marginBottom: '0.75rem'
              }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
              Back to Dashboard
            </Link>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Bell size={28} />
              Notifications
            </h1>
            <p style={{ color: '#64748b' }}>
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => loadNotifications(0)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                background: 'white',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: markingAllRead ? 'not-allowed' : 'pointer',
                }}
              >
                <CheckCheck size={16} />
                {markingAllRead ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          background: 'white',
          padding: '0.375rem',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: 'fit-content'
        }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.625rem 1.25rem',
              background: filter === 'all'
                ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                : 'transparent',
              color: filter === 'all' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            All ({total})
          </button>
          <button
            onClick={() => setFilter('unread')}
            style={{
              padding: '0.625rem 1.25rem',
              background: filter === 'unread'
                ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                : 'transparent',
              color: filter === 'unread' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <Bell size={36} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              {filter === 'unread'
                ? "You're all caught up! Check back later for new updates."
                : "When you have activity on your cases or squads, you'll see notifications here."}
            </p>
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {notifications.map((notification, idx) => (
              <div
                key={notification.id}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem',
                  borderBottom: idx < notifications.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: notification.read ? 'white' : '#f8fafc',
                  transition: 'all 0.2s',
                  cursor: notification.actionUrl ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification.id);
                  }
                  if (notification.actionUrl) {
                    router.push(notification.actionUrl);
                  }
                }}
              >
                {/* Icon */}
                {getNotificationIcon(notification.type)}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginBottom: '0.25rem'
                  }}>
                    <h4 style={{
                      fontWeight: notification.read ? '600' : '700',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      margin: 0
                    }}>
                      {notification.title}
                    </h4>
                    <span style={{
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      flexShrink: 0
                    }}>
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p style={{
                    color: '#64748b',
                    fontSize: '0.9rem',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    {notification.message}
                  </p>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginTop: '0.75rem'
                  }}>
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.75rem',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={14} />
                        Mark read
                      </button>
                    )}
                    {notification.actionUrl && (
                      <Link
                        href={notification.actionUrl}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.75rem',
                          background: '#e0e7ff',
                          color: '#4f46e5',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        View details
                      </Link>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        background: 'transparent',
                        color: '#94a3b8',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    flexShrink: 0,
                    marginTop: '0.25rem'
                  }} />
                )}
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div style={{
                padding: '1.25rem',
                textAlign: 'center',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  onClick={() => loadNotifications(notifications.length)}
                  disabled={loadingMore}
                  style={{
                    padding: '0.75rem 2rem',
                    background: loadingMore ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settings Link */}
        <div style={{
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <Link
            href="/settings/notifications"
            style={{
              color: '#4f46e5',
              textDecoration: 'none',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            Manage notification preferences
          </Link>
        </div>
      </div>
    </div>
  );
}
