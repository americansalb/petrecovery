'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TaskCoordination({ squadId, missionId, caseName, userRole, userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskType, setTaskType] = useState('SEARCH');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [assignedMemberId, setAssignedMemberId] = useState('');
  const [squadMembers, setSquadMembers] = useState([]);

  const isLeader = ['FOUNDER', 'LEADER'].includes(userRole);

  useEffect(() => {
    loadTasks();
    if (isLeader) {
      loadSquadMembers();
    }
  }, [squadId, missionId]);

  const loadTasks = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/tasks?missionId=${missionId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSquadMembers = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/members`);
      if (res.ok) {
        const data = await res.json();
        setSquadMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          title: taskTitle,
          description: taskDescription,
          type: taskType,
          priority: taskPriority,
          assignedTo: assignedMemberId || null
        })
      });

      if (res.ok) {
        // Reset form
        setTaskTitle('');
        setTaskDescription('');
        setTaskType('SEARCH');
        setTaskPriority('MEDIUM');
        setAssignedMemberId('');
        setShowCreateForm(false);

        // Reload tasks
        loadTasks();
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST'
      });

      if (res.ok) {
        loadTasks();
      }
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  const handleClaimTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/claim`, {
        method: 'POST'
      });

      if (res.ok) {
        loadTasks();
      }
    } catch (err) {
      console.error('Error claiming task:', err);
    }
  };

  const getTaskTypeInfo = (type) => {
    switch (type) {
      case 'SEARCH':
        return { icon: '🔍', label: 'Search Area', color: '#3b82f6' };
      case 'POSTER':
        return { icon: '📄', label: 'Post Flyers', color: '#8b5cf6' };
      case 'DOOR_TO_DOOR':
        return { icon: '🚪', label: 'Door-to-Door', color: '#f59e0b' };
      case 'SOCIAL_MEDIA':
        return { icon: '📱', label: 'Social Media', color: '#ec4899' };
      case 'SHELTER_CHECK':
        return { icon: '🏠', label: 'Shelter Check', color: '#10b981' };
      case 'INVESTIGATION':
        return { icon: '🔎', label: 'Investigation', color: '#6366f1' };
      case 'OTHER':
        return { icon: '📋', label: 'Other', color: '#64748b' };
      default:
        return { icon: '•', label: type, color: '#64748b' };
    }
  };

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'URGENT':
        return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', label: '🔥 URGENT' };
      case 'HIGH':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: '⚠️ High' };
      case 'MEDIUM':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', label: '📌 Medium' };
      case 'LOW':
        return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: '💤 Low' };
      default:
        return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: priority };
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const openTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      marginBottom: '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '0.25rem'
          }}>
            🎯 Task Coordination
          </h2>
          <p style={{
            fontSize: '0.9rem',
            color: '#64748b'
          }}>
            Organize search efforts for {caseName}
          </p>
        </div>

        {isLeader && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '0.75rem 1.5rem',
              background: showCreateForm ? '#cbd5e1' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            {showCreateForm ? '✕ Cancel' : '+ New Task'}
          </button>
        )}
      </div>

      {/* Create Task Form */}
      {showCreateForm && isLeader && (
        <form onSubmit={handleCreateTask} style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderRadius: '12px',
          marginBottom: '2rem',
          border: '2px solid #cbd5e1'
        }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '1.5rem'
          }}>
            Create New Task
          </h3>

          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Task Title */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Task Title *
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Search Main St to Oak Ave"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            {/* Task Description */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Description
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Provide details about what needs to be done..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Type & Priority */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  Task Type *
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="SEARCH">🔍 Search Area</option>
                  <option value="DOOR_TO_DOOR">🚪 Door-to-Door</option>
                  <option value="POSTER">📄 Post Flyers</option>
                  <option value="SOCIAL_MEDIA">📱 Social Media</option>
                  <option value="SHELTER_CHECK">🏠 Shelter Check</option>
                  <option value="INVESTIGATION">🔎 Investigation</option>
                  <option value="OTHER">📋 Other</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  Priority *
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="URGENT">🔥 Urgent</option>
                  <option value="HIGH">⚠️ High</option>
                  <option value="MEDIUM">📌 Medium</option>
                  <option value="LOW">💤 Low</option>
                </select>
              </div>
            </div>

            {/* Assign To */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Assign To (Optional)
              </label>
              <select
                value={assignedMemberId}
                onChange={(e) => setAssignedMemberId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Unassigned (Anyone can claim)</option>
                {squadMembers.map(member => (
                  <option key={member.id} value={member.userId}>
                    {member.user.firstName} {member.user.lastName} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creating || !taskTitle}
              style={{
                padding: '1rem',
                background: creating || !taskTitle
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: creating || !taskTitle ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              {creating ? 'Creating Task...' : '✓ Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Tasks List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Loading tasks...
        </div>
      ) : (
        <>
          {/* Open Tasks */}
          {openTasks.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '800',
                color: '#0f172a',
                marginBottom: '1rem'
              }}>
                🔓 Open Tasks ({openTasks.length})
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {openTasks.map(task => {
                  const typeInfo = getTaskTypeInfo(task.type);
                  const priorityInfo = getPriorityInfo(task.priority);
                  const isAssignedToUser = task.assignedToId === userId;
                  const canClaim = !task.assignedToId && !isAssignedToUser;

                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: '1.5rem',
                        background: isAssignedToUser
                          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                          : 'white',
                        border: isAssignedToUser
                          ? '3px solid #10b981'
                          : '2px solid #e2e8f0',
                        borderRadius: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            color: '#0f172a',
                            marginBottom: '0.5rem'
                          }}>
                            {task.title}
                          </h4>

                          {task.description && (
                            <p style={{
                              fontSize: '0.95rem',
                              color: '#64748b',
                              lineHeight: '1.5',
                              marginBottom: '1rem'
                            }}>
                              {task.description}
                            </p>
                          )}

                          <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                            alignItems: 'center'
                          }}>
                            {/* Type Badge */}
                            <div style={{
                              padding: '0.4rem 0.75rem',
                              background: `${typeInfo.color}20`,
                              color: typeInfo.color,
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: '700'
                            }}>
                              {typeInfo.icon} {typeInfo.label}
                            </div>

                            {/* Priority Badge */}
                            <div style={{
                              padding: '0.4rem 0.75rem',
                              background: priorityInfo.bg,
                              color: priorityInfo.text,
                              border: `2px solid ${priorityInfo.border}`,
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: '700'
                            }}>
                              {priorityInfo.label}
                            </div>

                            {/* Assigned To */}
                            {task.assignedTo && (
                              <div style={{
                                padding: '0.4rem 0.75rem',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '700'
                              }}>
                                👤 {task.assignedTo.firstName} {task.assignedTo.lastName}
                              </div>
                            )}

                            {/* Created Time */}
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#94a3b8',
                              fontWeight: '600'
                            }}>
                              Created {formatTimeAgo(task.createdAt)}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          {isAssignedToUser && (
                            <button
                              onClick={() => handleCompleteTask(task.id)}
                              style={{
                                padding: '0.75rem 1.25rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              ✓ Mark Complete
                            </button>
                          )}

                          {canClaim && (
                            <button
                              onClick={() => handleClaimTask(task.id)}
                              style={{
                                padding: '0.75rem 1.25rem',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                              }}
                            >
                              🚀 Claim Task
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '800',
                color: '#0f172a',
                marginBottom: '1rem'
              }}>
                ✅ Completed Tasks ({completedTasks.length})
              </h3>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {completedTasks.map(task => {
                  const typeInfo = getTaskTypeInfo(task.type);

                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        border: '2px solid #cbd5e1',
                        borderRadius: '8px',
                        opacity: 0.7
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: '#475569',
                            marginBottom: '0.25rem',
                            textDecoration: 'line-through'
                          }}>
                            {task.title}
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#64748b'
                          }}>
                            {typeInfo.icon} {typeInfo.label} • Completed {formatTimeAgo(task.completedAt)}
                            {task.completedBy && ` by ${task.completedBy.firstName} ${task.completedBy.lastName}`}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '2rem',
                          color: '#10b981'
                        }}>
                          ✓
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Tasks */}
          {openTasks.length === 0 && completedTasks.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
                No Tasks Yet
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                {isLeader
                  ? 'Create tasks to coordinate search efforts with your team'
                  : 'Rescue Force leaders will create tasks to organize the search'}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
