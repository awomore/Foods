import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius } from '../../constants/theme';

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  placeholder?: string;
  initialValue?: string;
  onSelect: (address: string) => void;
  onCancel?: () => void;
}

export default function GooglePlacesInput({ placeholder, initialValue, onSelect, onCancel }: Props) {
  const C = useColors();
  const [query, setQuery] = useState(initialValue ?? '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (text: string) => {
    if (!text.trim() || text.length < 3) { setPredictions([]); return; }
    if (!MAPS_KEY) {
      // No API key — skip validation and just accept the typed address
      return;
    }
    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&components=country:ng&types=address&key=${MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK') setPredictions(data.predictions ?? []);
      else setPredictions([]);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 350);
  }

  function handleSelect(prediction: Prediction) {
    setQuery(prediction.description);
    setPredictions([]);
    onSelect(prediction.description);
  }

  function handleManualConfirm() {
    if (!query.trim()) return;
    setPredictions([]);
    onSelect(query.trim());
  }

  const S = styles(C);

  return (
    <View style={S.root}>
      <View style={S.inputRow}>
        <Ionicons name="location-outline" size={18} color={C.spice} style={{ marginRight: 6 }} />
        <TextInput
          style={S.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder ?? 'Enter delivery address'}
          placeholderTextColor={C.stone}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleManualConfirm}
        />
        {loading && <ActivityIndicator size="small" color={C.spice} style={{ marginLeft: 6 }} />}
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setPredictions([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={C.bodySoft} />
          </TouchableOpacity>
        )}
      </View>

      {predictions.length > 0 && (
        <FlatList
          data={predictions}
          keyExtractor={p => p.place_id}
          style={S.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={S.suggestion} onPress={() => handleSelect(item)} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={14} color={C.bodySoft} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={S.mainText}>{item.structured_formatting.main_text}</Text>
                <Text style={S.secondaryText} numberOfLines={1}>{item.structured_formatting.secondary_text}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* If no API key, show plain confirm option */}
      {!MAPS_KEY && query.trim().length > 5 && predictions.length === 0 && (
        <TouchableOpacity style={S.manualConfirm} onPress={handleManualConfirm} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={16} color={C.spice} />
          <Text style={S.manualConfirmText}>Use "{query.trim()}"</Text>
        </TouchableOpacity>
      )}

      {onCancel && (
        <TouchableOpacity style={S.cancelBtn} onPress={onCancel}>
          <Text style={S.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg,
    borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  input: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  list: { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5,
    borderColor: C.borderWarm, maxHeight: 260 },
  suggestion: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12,
    borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  mainText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  secondaryText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
  manualConfirm: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    backgroundColor: C.bgCook, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm },
  manualConfirmText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice, flex: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
});
