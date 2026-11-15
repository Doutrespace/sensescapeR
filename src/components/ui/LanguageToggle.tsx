import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { LANGUAGES, useLanguageStore } from '../../i18n';

/** Two-way switch between English and German. Applies immediately. */
export function LanguageToggle() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel="Language / Sprache">
      {LANGUAGES.map((option) => {
        const selected = option.code === language;
        return (
          <TouchableOpacity
            key={option.code}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => {
              if (!selected) {
                void Haptics.selectionAsync();
                void setLanguage(option.code);
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {option.code.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  option: {
    minWidth: 44,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: Colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  optionTextSelected: {
    color: Colors.surface,
  },
});
