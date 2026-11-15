import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { useAuthStore } from '../../stores/useAuthStore';
import { ResearchProfileFields } from '../profile/ResearchProfileFields';
import type { ResearchProfile } from '../../types/researchProfile';
import { t } from '../../i18n';

type AuthMode = 'signin' | 'signup';

interface Props {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: Props) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResearchProfile, setShowResearchProfile] = useState(false);
  const [researchProfile, setResearchProfile] = useState<ResearchProfile>({});

  const { signIn, signUp, isLoading, error, statusMessage, clearError, isConfigured } = useAuthStore();

  const handleSubmit = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, { research_profile: researchProfile });

    if (!result.error && result.hasActiveSession) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
    } else if (result.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('signin');
      setPassword('');
    }
  };

  const toggleMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearError();
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setShowResearchProfile(false);
  };

  if (!isConfigured) {
    return (
      <View style={styles.notConfigured}>
        <MaterialIcons name="cloud-off" size={48} color={Colors.textMuted} />
        <Text style={styles.notConfiguredTitle}>{t('Cloud Not Configured')}</Text>
        <Text style={styles.notConfiguredText}>
          {t('To enable sign in, configure Supabase credentials in your environment variables.')}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons
          name={mode === 'signin' ? 'login' : 'person-add'}
          size={48}
          color={Colors.primary}
        />
      </View>

      <Text style={styles.title}>
        {mode === 'signin' ? t('Welcome Back') : t('Create Account')}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'signin'
          ? t('Sign in to sync your recordings')
          : t('Join the soundscape research community')}
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!error && statusMessage && (
        <View style={styles.infoContainer}>
          <MaterialIcons name="mail-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>{statusMessage}</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <MaterialIcons name="email" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={t('Email')}
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>

      <View style={styles.inputContainer}>
        <MaterialIcons name="lock" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={t('Password')}
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <MaterialIcons
            name={showPassword ? 'visibility-off' : 'visibility'}
            size={20}
            color={Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {mode === 'signup' && (
        <View style={styles.researchCard}>
          <TouchableOpacity
            style={styles.researchHeader}
            onPress={() => setShowResearchProfile((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={t('Optional research profile')}
          >
            <View style={styles.researchHeaderText}>
              <Text style={styles.researchTitle}>{t('Optional research profile')}</Text>
              <Text style={styles.researchSubtitle}>
                {t('Add a few demographic details for soundscape research context. This is optional and stored securely with your account.')}
              </Text>
            </View>
            <MaterialIcons
              name={showResearchProfile ? 'expand-less' : 'expand-more'}
              size={22}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {showResearchProfile && (
            <View style={styles.researchFieldsWrap}>
              <ResearchProfileFields
                value={researchProfile}
                onChange={setResearchProfile}
                showIntro={false}
              />
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <>
            <Text style={styles.submitButtonText}>
              {mode === 'signin' ? t('Sign In') : t('Sign Up')}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color={Colors.background} />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
        <Text style={styles.toggleText}>
          {mode === 'signin'
            ? "Don't have an account? Sign Up"
            : t('Already have an account? Sign In')}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorMuted,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.primary,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
  },
  toggleButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: Colors.primary,
  },
  researchCard: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  researchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  researchHeaderText: {
    flex: 1,
  },
  researchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  researchSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  researchFieldsWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  notConfigured: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  notConfiguredTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  notConfiguredText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
