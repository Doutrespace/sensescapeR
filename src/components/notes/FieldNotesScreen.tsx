import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../theme/colors';
import {
  NOTE_PROMPTS,
  appendPromptSeed,
  extractNoteThemes,
} from '../../utils/noteAnalysis';

interface Props {
  fieldNotes: string;
  spokenDescription: string;
  onFieldNotesChange: (value: string) => void;
  onSpokenDescriptionChange: (value: string) => void;
  voiceTranscriptionSupported?: boolean;
  isTranscribingSpokenDescription?: boolean;
  onRecordSpokenDescription?: () => void;
  onClearSpokenDescription?: () => void;
  onContinue: () => void;
}

export default function FieldNotesScreen({
  fieldNotes,
  spokenDescription,
  onFieldNotesChange,
  onSpokenDescriptionChange,
  voiceTranscriptionSupported = false,
  isTranscribingSpokenDescription = false,
  onRecordSpokenDescription,
  onClearSpokenDescription,
  onContinue,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPadding = tabBarHeight + insets.bottom + 12;
  const noteThemes = extractNoteThemes(fieldNotes, spokenDescription);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 92 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Observation Notes</Text>
          <Text style={styles.title}>Capture the experience in words</Text>
          <Text style={styles.subtitle}>
            Add short field notes or a spoken description transcript before you rate the soundscape.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="edit-note" size={18} color={Colors.primary} />
            </View>
            <View style={styles.sectionText}>
              <Text style={styles.sectionTitle}>Field notes</Text>
              <Text style={styles.sectionDescription}>
                What stood out at this place? Include people, activities, weather, or notable sounds.
              </Text>
            </View>
          </View>

          <View style={styles.promptGroup}>
            <Text style={styles.promptGroupLabel}>Guided prompts</Text>
            <View style={styles.promptList}>
              {NOTE_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt.id}
                  style={styles.promptChip}
                  onPress={() => onFieldNotesChange(appendPromptSeed(fieldNotes, prompt.seed))}
                  accessibilityRole="button"
                  accessibilityLabel={prompt.label}
                  accessibilityHint="Insert a guided note prompt into the field notes"
                >
                  <Text style={styles.promptChipText}>{prompt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Field notes"
            accessibilityHint="Enter written notes about the place and notable sounds"
            placeholder="Example: Light traffic from the road, birds in the trees, occasional conversation from nearby benches."
            placeholderTextColor={Colors.textDisabled}
            value={fieldNotes}
            onChangeText={onFieldNotesChange}
            maxLength={600}
          />
          <Text style={styles.characterCount}>{fieldNotes.length}/600</Text>

          {noteThemes.length > 0 && (
            <View style={styles.themeGroup}>
              <Text style={styles.themeGroupLabel}>Detected note themes</Text>
              <View style={styles.themeList}>
                {noteThemes.map((theme) => (
                  <View key={theme.key} style={styles.themeChip}>
                    <Text style={styles.themeChipText}>{theme.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="keyboard-voice" size={18} color={Colors.primary} />
            </View>
            <View style={styles.sectionText}>
              <Text style={styles.sectionTitle}>Spoken description</Text>
              {!voiceTranscriptionSupported && (
                <Text style={styles.sectionDescription}>
                  Use keyboard dictation if you prefer speaking.
                </Text>
              )}
            </View>
          </View>

          {voiceTranscriptionSupported ? (
            <View style={styles.voiceCaptureBlock}>
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isTranscribingSpokenDescription && styles.voiceButtonActive,
                ]}
                onPress={onRecordSpokenDescription}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={isTranscribingSpokenDescription ? 'Stop spoken description recording' : 'Start spoken description recording'}
                accessibilityHint="Start or stop voice transcription for the spoken description"
              >
                <MaterialIcons
                  name={isTranscribingSpokenDescription ? 'stop' : 'keyboard-voice'}
                  size={34}
                  color={Colors.background}
                />
              </TouchableOpacity>
              <Text style={styles.voiceButtonLabel}>
                {isTranscribingSpokenDescription ? 'Tap again to stop' : 'Tap to record'}
              </Text>

              {spokenDescription.trim().length > 0 ? (
                <View style={styles.transcriptCard}>
                  <View style={styles.transcriptCardHeader}>
                    <Text style={styles.transcriptCardLabel}>Transcript</Text>
                    <View style={styles.transcriptActions}>
                      <TouchableOpacity
                        onPress={onClearSpokenDescription}
                        accessibilityRole="button"
                        accessibilityLabel="Clear saved transcript"
                      >
                        <Text style={styles.transcriptActionText}>
                          Clear
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.transcriptPreview}>{spokenDescription}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <TextInput
              style={[styles.textArea, styles.transcriptArea]}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Spoken description transcript"
              accessibilityHint="Enter or dictate a transcript describing the place"
              placeholder="Dictated transcript or transcribed voice note"
              placeholderTextColor={Colors.textDisabled}
              value={spokenDescription}
              onChangeText={onSpokenDescriptionChange}
              maxLength={600}
            />
          )}
          <Text style={styles.characterCount}>{spokenDescription.length}/600</Text>
        </View>
      </ScrollView>

      <View style={[styles.actionsDock, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinue}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Continue from notes"
          accessibilityHint="Save the notes and continue to perceptual assessment"
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: Colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: Colors.textMuted,
    maxWidth: 360,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMuted,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  textArea: {
    minHeight: 132,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: '#F7F3EA',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  transcriptArea: {
    minHeight: 120,
  },
  voiceCaptureBlock: {
    alignItems: 'center',
  },
  voiceButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    ...({
      shadowColor: '#171717',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 7,
    }),
  },
  voiceButtonActive: {
    backgroundColor: Colors.error,
  },
  voiceButtonLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  transcriptCard: {
    marginTop: 18,
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: '#F7F3EA',
    padding: 14,
  },
  transcriptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  transcriptCardLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  transcriptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transcriptActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  transcriptPreview: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  characterCount: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  promptGroup: {
    marginBottom: 14,
  },
  promptGroupLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  promptList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  promptChipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  themeGroup: {
    marginTop: 12,
  },
  themeGroupLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  themeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryMuted,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  actionsDock: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.lg,
    paddingTop: 14,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.background,
  },
});
