import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Colors } from '../theme/colors';
import { LoggingService } from '../services/logging';

const RECORDING_OPTIONS_WAV: Audio.RecordingOptions = {
    isMeteringEnabled: true,
    android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
    },
    ios: {
        extension: '.wav',
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
    },
};

interface Props {
    onRecordingComplete: (uri: string) => void;
}

export default function AudioRecorder({ onRecordingComplete }: Props) {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const maxDuration = 10000; // 10 seconds

    useEffect(() => {
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, [recording]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') return;

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS_WAV);

            setRecording(recording);
            setIsRecording(true);
            setDuration(0);
        } catch (err) {
            LoggingService.error('Failed to start legacy audio recording', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    };

    const stopRecording = async (rec: Audio.Recording) => {
        setIsRecording(false);
        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            if (uri) {
                onRecordingComplete(uri);
            }
            setRecording(null);
        } catch (err) {
            LoggingService.error('Failed to stop legacy audio recording', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (recording && isRecording) {
            interval = setInterval(async () => {
                const status = await recording.getStatusAsync();
                if (status.isDoneRecording) return;
                setDuration(status.durationMillis);
                if (status.durationMillis >= maxDuration) {
                    clearInterval(interval);
                    stopRecording(recording);
                }
            }, 50);
        }
        return () => clearInterval(interval);
    }, [recording, isRecording]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Soundscape Recorder</Text>
            <Text style={styles.subtitle}>
                {isRecording
                    ? `Recording... ${(duration / 1000).toFixed(1)}s / 10.0s`
                    : 'Ready to record exactly 10 seconds of environment audio'}
            </Text>

            <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordingButtonActive]}
                onPress={isRecording ? () => { } : startRecording}
                disabled={isRecording}
            >
                <Text style={styles.buttonText}>{isRecording ? 'Recording...' : 'Start Measurement'}</Text>
            </TouchableOpacity>

            {isRecording && (
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${(duration / maxDuration) * 100}%` }]} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        marginBottom: 48,
        textAlign: 'center',
    },
    recordButton: {
        backgroundColor: Colors.primary,
        width: 220,
        height: 64,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: Colors.primary,
        shadowOpacity: 0.5,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    recordingButtonActive: {
        backgroundColor: Colors.error,
        shadowColor: Colors.error,
        shadowOpacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    buttonText: {
        color: Colors.background,
        fontSize: 18,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    progressContainer: {
        marginTop: 48,
        width: '100%',
        height: 8,
        backgroundColor: Colors.surfaceHighlight,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.error,
        borderRadius: 4,
    },
});
