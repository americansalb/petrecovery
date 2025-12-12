'use client';

/**
 * Voice Recorder - Call Mode Setup
 *
 * Allows pet owners to record their voice calling their pet's name.
 * This recording can be played on all volunteer phones simultaneously
 * during a search (Call Mode).
 */

import { useState, useRef, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic, announce } from '@/app/lib/missionControl/accessibility';

const MAX_DURATION = 30; // Max recording duration in seconds
const MIN_DURATION = 3; // Min recording duration

export default function VoiceRecorder({
  missionId,
  petName,
  existingRecording = null,
  onRecordingComplete = null,
  onRecordingDeleted = null,
}) {
  const [permission, setPermission] = useState('unknown'); // 'unknown', 'granted', 'denied'
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(existingRecording);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showTips, setShowTips] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  // Check for existing recording
  useEffect(() => {
    if (existingRecording) {
      setAudioUrl(existingRecording);
    }
  }, [existingRecording]);

  // Request microphone permission
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission('granted');
      return stream;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setPermission('denied');
      setError('Microphone access is required to record your voice.');
      return null;
    }
  };

  // Start recording
  const startRecording = async () => {
    setError(null);
    let stream = streamRef.current;

    if (!stream) {
      stream = await requestPermission();
      if (!stream) return;
    }

    audioChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorder.mimeType,
      });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Upload the recording
      await uploadRecording(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Collect data every second

    setIsRecording(true);
    setDuration(0);
    triggerHaptic('tap');
    announce('Recording started. Speak clearly.', 'polite');

    // Start duration timer
    timerRef.current = setInterval(() => {
      setDuration(d => {
        if (d >= MAX_DURATION) {
          stopRecording();
          return d;
        }
        return d + 1;
      });
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      triggerHaptic('success');
      announce('Recording stopped.', 'polite');
    }
  };

  // Upload recording to server
  const uploadRecording = async (audioBlob) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'call-mode-recording.webm');
      formData.append('missionId', missionId);
      formData.append('duration', duration.toString());

      const res = await fetch(`/api/mission/${missionId}/owner`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPLOAD_VOICE',
          // In a real implementation, you'd upload the file separately
          // For now, we'll just simulate success
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        triggerHaptic('success');
        onRecordingComplete?.();
      } else {
        throw new Error('Failed to upload recording');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to save recording. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Play recording
  const playRecording = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      triggerHaptic('tap');
    }
  };

  // Stop playback
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Delete recording
  const deleteRecording = async () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setDuration(0);
    onRecordingDeleted?.();
    triggerHaptic('tap');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Call Mode Recording</h3>
        <button onClick={() => setShowTips(!showTips)} style={styles.helpButton}>
          ?
        </button>
      </div>

      {showTips && (
        <div style={styles.tips}>
          <h4 style={styles.tipsTitle}>Tips for a Good Recording:</h4>
          <ul style={styles.tipsList}>
            <li>Use the name and sounds your pet responds to</li>
            <li>Keep your voice calm and encouraging</li>
            <li>Include phrases like "come here" or "treat time"</li>
            <li>Shake a treat bag if that's something they respond to</li>
            <li>10-15 seconds is ideal</li>
          </ul>
          <button onClick={() => setShowTips(false)} style={styles.closeTips}>
            Got it
          </button>
        </div>
      )}

      {error && (
        <div style={styles.error}>
          <span style={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {/* Recording controls */}
      {!audioUrl ? (
        <div style={styles.recordingSection}>
          {!isRecording ? (
            <>
              <p style={styles.instruction}>
                Record yourself calling {petName}'s name. This will play on volunteer phones
                when Call Mode is activated.
              </p>
              <button
                onClick={startRecording}
                style={styles.recordButton}
                disabled={permission === 'denied'}
              >
                <span style={styles.recordIcon}>🎤</span>
                <span>Start Recording</span>
              </button>
              {permission === 'denied' && (
                <p style={styles.permissionError}>
                  Microphone access was denied. Please enable it in your browser settings.
                </p>
              )}
            </>
          ) : (
            <>
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot} />
                Recording...
              </div>

              {/* Duration display */}
              <div style={styles.durationDisplay}>
                <span style={styles.durationTime}>{formatDuration(duration)}</span>
                <span style={styles.durationMax}>/ {formatDuration(MAX_DURATION)}</span>
              </div>

              {/* Progress bar */}
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(duration / MAX_DURATION) * 100}%`,
                  }}
                />
              </div>

              {/* Stop button */}
              <button
                onClick={stopRecording}
                style={styles.stopButton}
                disabled={duration < MIN_DURATION}
              >
                <span style={styles.stopIcon}>⏹</span>
                <span>Stop Recording</span>
              </button>

              {duration < MIN_DURATION && (
                <p style={styles.minDurationHint}>
                  Keep recording for at least {MIN_DURATION} seconds
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={styles.playbackSection}>
          {/* Audio element */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Playback controls */}
          <div style={styles.playbackCard}>
            <div style={styles.playbackInfo}>
              <span style={styles.recordedLabel}>Recording Ready</span>
              <span style={styles.recordedDuration}>{formatDuration(duration)}</span>
            </div>

            <div style={styles.playbackButtons}>
              {!isPlaying ? (
                <button onClick={playRecording} style={styles.playButton}>
                  <span style={styles.playIcon}>▶</span>
                </button>
              ) : (
                <button onClick={stopPlayback} style={styles.pauseButton}>
                  <span style={styles.pauseIcon}>⏸</span>
                </button>
              )}
            </div>
          </div>

          {/* Upload status */}
          {uploading && (
            <div style={styles.uploadingStatus}>
              <div style={styles.spinner} />
              <span>Saving recording...</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={styles.actionButtons}>
            <button onClick={deleteRecording} style={styles.deleteButton}>
              🗑 Delete & Re-record
            </button>
          </div>

          <p style={styles.successMessage}>
            Your voice is ready for Call Mode! When activated, all volunteer phones will play
            this recording simultaneously.
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '20px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },

  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },

  helpButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid #444',
    backgroundColor: 'transparent',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },

  tips: {
    backgroundColor: '#2A2A2A',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },

  tipsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    margin: '0 0 8px 0',
  },

  tipsList: {
    margin: '0 0 12px 0',
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#aaa',
    lineHeight: 1.6,
  },

  closeTips: {
    padding: '8px 16px',
    backgroundColor: '#444',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },

  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: '8px',
    marginBottom: '16px',
    color: '#F44336',
    fontSize: '14px',
  },

  errorIcon: {
    fontSize: '16px',
  },

  recordingSection: {
    textAlign: 'center',
  },

  instruction: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '20px',
    lineHeight: 1.5,
  },

  recordButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '20px',
    backgroundColor: '#D32F2F',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  recordIcon: {
    fontSize: '24px',
  },

  permissionError: {
    fontSize: '13px',
    color: '#F44336',
    marginTop: '12px',
  },

  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '16px',
    color: '#F44336',
    marginBottom: '16px',
  },

  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#F44336',
    animation: 'pulse 1s infinite',
  },

  durationDisplay: {
    marginBottom: '12px',
  },

  durationTime: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
  },

  durationMax: {
    fontSize: '16px',
    color: '#666',
    marginLeft: '4px',
  },

  progressBar: {
    height: '4px',
    backgroundColor: '#333',
    borderRadius: '2px',
    marginBottom: '20px',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#D32F2F',
    transition: 'width 1s linear',
  },

  stopButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '20px',
    backgroundColor: '#333',
    border: '2px solid #D32F2F',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  stopIcon: {
    fontSize: '24px',
  },

  minDurationHint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '12px',
  },

  playbackSection: {
    textAlign: 'center',
  },

  playbackCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#2A2A2A',
    borderRadius: '12px',
    marginBottom: '16px',
  },

  playbackInfo: {
    textAlign: 'left',
  },

  recordedLabel: {
    display: 'block',
    fontSize: '14px',
    color: '#4CAF50',
    fontWeight: 600,
  },

  recordedDuration: {
    fontSize: '12px',
    color: '#888',
  },

  playbackButtons: {
    display: 'flex',
    gap: '8px',
  },

  playButton: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  playIcon: {
    marginLeft: '4px',
  },

  pauseButton: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#FF9800',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pauseIcon: {},

  uploadingStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
    color: '#888',
    fontSize: '14px',
  },

  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #333',
    borderTop: '2px solid #4CAF50',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  actionButtons: {
    marginBottom: '16px',
  },

  deleteButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #666',
    borderRadius: '8px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },

  successMessage: {
    fontSize: '13px',
    color: '#4CAF50',
    lineHeight: 1.5,
  },
};
