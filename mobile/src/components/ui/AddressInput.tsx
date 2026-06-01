import React, { useState, useRef, useCallback } from 'react';
import {
  View, TextInput, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize } from '../../constants/theme';

export interface PlaceResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: PlaceResult) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';

export default function AddressInput({
  value, onChangeText, onSelectPlace,
  placeholder = 'Enter address', label, error,
}: Props) {
  const C = useColors();
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3 || !GOOGLE_PLACES_KEY) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_PLACES_KEY}&components=country:ng&types=address`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'OK') {
        const results: PlaceResult[] = json.predictions.map((p: any) => ({
          place_id: p.place_id,
          description: p.description,
          main_text: p.structured_formatting?.main_text ?? p.description,
          secondary_text: p.structured_formatting?.secondary_text ?? '',
        }));
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
  };

  const handleSelect = (place: PlaceResult) => {
    onChangeText(place.description);
    onSelectPlace(place);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const s = StyleSheet.create({
    container: { gap: 4 },
    label: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.sm,
      color: C.body,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: error ? C.errorFg : C.borderWarm,
      borderRadius: Radius.md,
      backgroundColor: C.bgCard,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: Fonts.sans,
      fontSize: FontSize.body,
      color: C.ink,
      paddingVertical: Spacing.md,
    },
    errorText: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      color: C.errorFg,
    },
    dropdown: {
      position: 'absolute',
      top: label ? 72 : 52,
      left: 0,
      right: 0,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.borderWarm,
      borderRadius: Radius.md,
      zIndex: 999,
      elevation: 8,
      shadowColor: C.ink,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      maxHeight: 220,
    },
    suggestionItem: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.borderWarm,
    },
    suggestionMain: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.body,
      color: C.ink,
    },
    suggestionSub: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      color: C.bodySoft,
      marginTop: 1,
    },
  });

  return (
    <View style={s.container}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={s.inputRow}>
        <Ionicons name="location-outline" size={18} color={C.bodySoft} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={C.stone}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {loading && <ActivityIndicator size="small" color={C.spice} />}
        {!loading && value.length > 0 && (
          <TouchableOpacity onPress={() => { onChangeText(''); setSuggestions([]); setShowDropdown(false); }}>
            <Ionicons name="close-circle" size={18} color={C.stone} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={s.errorText}>{error}</Text>}
      {showDropdown && (
        <View style={s.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={s.suggestionItem} onPress={() => handleSelect(item)}>
                <Text style={s.suggestionMain}>{item.main_text}</Text>
                {item.secondary_text ? (
                  <Text style={s.suggestionSub}>{item.secondary_text}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}
