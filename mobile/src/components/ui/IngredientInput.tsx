import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INGREDIENT_SUGGESTIONS } from '../../utils/allergens';
import { useColors, type AppColors } from '../../context/ThemeContext';
import { Fonts, Radius } from '../../constants/theme';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export default function IngredientInput({ value, onChange }: Props) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);

  const [text, setText] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return INGREDIENT_SUGGESTIONS
      .filter(s => s.toLowerCase().includes(q) && !value.includes(s))
      .slice(0, 6);
  }, [text, value]);

  function commit(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (editIdx !== null) {
      onChange(value.map((v, i) => (i === editIdx ? t : v)));
      setEditIdx(null);
    } else if (!value.includes(t)) {
      onChange([...value, t]);
    }
    setText('');
  }

  function startEdit(idx: number) {
    setText(value[idx]);
    setEditIdx(idx);
  }

  function cancelEdit() {
    setEditIdx(null);
    setText('');
  }

  function remove(idx: number) {
    if (editIdx === idx) { setEditIdx(null); setText(''); }
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <View style={S.root}>
      {/* Chips */}
      {value.length > 0 && (
        <View style={S.chips}>
          {value.map((ing, idx) => (
            <View key={idx} style={[S.chip, editIdx === idx && S.chipEditing]}>
              <TouchableOpacity onPress={() => startEdit(idx)} activeOpacity={0.7}>
                <Text style={S.chipText}>{ing}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(idx)} style={S.chipRemove} hitSlop={8}>
                <Ionicons name="close" size={11} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input row */}
      <View style={S.inputRow}>
        <TextInput
          style={S.input}
          value={text}
          onChangeText={setText}
          placeholder={editIdx !== null ? 'Edit ingredient…' : 'Add ingredient…'}
          placeholderTextColor={C.stone}
          returnKeyType="done"
          onSubmitEditing={() => commit(text)}
        />
        {editIdx !== null ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={cancelEdit} style={[S.actionBtn, { backgroundColor: C.borderWarm }]}>
              <Ionicons name="close" size={16} color={C.body} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => commit(text)} style={S.actionBtn}>
              <Ionicons name="checkmark" size={16} color={C.canvas} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => commit(text)} style={S.actionBtn}>
            <Ionicons name="add" size={18} color={C.canvas} />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <View style={S.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s}
              onPress={() => commit(s)}
              style={[S.suggestion, i < suggestions.length - 1 && S.suggestionBorder]}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={14} color={C.spice} />
              <Text style={S.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.bgCook, borderRadius: 40,
      paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    chipEditing: { borderColor: C.spice, borderWidth: 1 },
    chipText: { fontFamily: Fonts.sans, fontSize: 12, color: C.textInk },
    chipRemove: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
      flex: 1, backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5,
      borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 9,
      fontFamily: Fonts.sans, fontSize: 14, color: C.textInk,
    },
    actionBtn: {
      width: 38, height: 38, borderRadius: Radius.md, backgroundColor: C.ink,
      alignItems: 'center', justifyContent: 'center',
    },
    dropdown: {
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 0.5, borderColor: C.borderWarm, overflow: 'hidden',
    },
    suggestion: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    suggestionBorder: { borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    suggestionText: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk },
  });
}
