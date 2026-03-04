import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StyleSheet, Alert, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { fetchCards, fetchCategories, searchMerchants, getRecommendations } from '../lib/api';
import type { Card, Merchant, Category, Recommendation, MerchantMatch } from '../lib/api';
import { fetchGoogleUser, saveUser, loadUser, clearUser } from '../lib/auth';
import type { User } from '../lib/auth';

WebBrowser.maybeCompleteAuthSession();

// Replace with your iOS client ID from Google Cloud Console
const GOOGLE_IOS_CLIENT_ID = '517026320231-5qj1rochv8lr6qj3k98q6qh2p6nahhb7.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

const SAVED_CARDS_KEY = 'saved_cards';

export default function HomeScreen() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [cardSearch, setCardSearch] = useState('');
  const [showCardDropdown, setShowCardDropdown] = useState(false);

  const [merchantQuery, setMerchantQuery] = useState('');
  const [merchantSuggestions, setMerchantSuggestions] = useState<Merchant[]>([]);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [merchantMatch, setMerchantMatch] = useState<MerchantMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  // Load cards and categories
  useEffect(() => {
    fetchCards().then(setAllCards);
    fetchCategories().then(setCategories);
    loadUser().then(setUser);
  }, []);

  // Handle Google sign-in response
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) {
        fetchGoogleUser(token).then(u => {
          saveUser(u);
          setUser(u);
        });
      }
    }
  }, [response]);

  // Load saved cards from storage
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(SAVED_CARDS_KEY).then(val => {
      if (val) setSelectedCards(JSON.parse(val));
    });
  }, []));

  // Save cards to storage when changed
  useEffect(() => {
    AsyncStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(selectedCards));
  }, [selectedCards]);

  // Merchant autocomplete
  useEffect(() => {
    if (merchantQuery.length < 1) { setMerchantSuggestions([]); return; }
    const timer = setTimeout(() => {
      searchMerchants(merchantQuery).then(setMerchantSuggestions);
    }, 250);
    return () => clearTimeout(timer);
  }, [merchantQuery]);

  const filteredCards = allCards.filter(c =>
    c.name.toLowerCase().includes(cardSearch.toLowerCase()) &&
    !selectedCards.find(s => s.id === c.id)
  );

  const addCard = (card: Card) => {
    setSelectedCards(p => [...p, card]);
    setCardSearch('');
    setShowCardDropdown(false);
  };

  const removeCard = (id: number) => {
    setSelectedCards(p => p.filter(c => c.id !== id));
    setRecommendations(null);
  };

  const findBestCard = async (overrideCategoryId?: number | null) => {
    if (!merchantQuery || selectedCards.length === 0) {
      Alert.alert('Missing info', 'Please add at least one card and enter a merchant.');
      return;
    }
    setLoading(true);
    setShowCategoryPicker(false);
    setShowMerchantDropdown(false);
    try {
      const data = await getRecommendations(
        selectedCards.map(c => c.id),
        merchantQuery,
        overrideCategoryId
      );
      setMerchantMatch(data.merchant);
      if (!data.merchant.merchantId && overrideCategoryId == null) {
        setShowCategoryPicker(true);
        setRecommendations(null);
      } else {
        setRecommendations(data.recommendations);
      }
    } catch {
      Alert.alert('Error', 'Could not fetch recommendations. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatReward = (rec: Recommendation) => {
    if (rec.rewardType === 'points') return `${rec.rate}x pts`;
    return `${rec.rate}% back`;
  };

  const formatEffective = (rec: Recommendation) => {
    if (rec.rewardType !== 'points') return null;
    return `~${rec.effectiveRate.toFixed(1)}% value`;
  };

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>🐾 Pick The Best Card</Text>
            <Text style={s.headerSub}>Find the best card for any store</Text>
          </View>
          {user ? (
            <TouchableOpacity style={s.userBtn} onPress={() => { clearUser(); setUser(null); }}>
              {user.picture
                ? <Image source={{ uri: user.picture }} style={s.avatar} />
                : <Text style={s.avatarInitial}>{user.name?.[0] ?? '?'}</Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.signInBtn}
              onPress={() => promptAsync()}
              disabled={!request}
            >
              <Text style={s.signInText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Card selector */}
      <View style={s.section}>
        <Text style={s.label}>Your Cards</Text>
        <View style={s.selectedCards}>
          {selectedCards.map(card => (
            <View key={card.id} style={[s.cardChip, { borderColor: card.color }]}>
              <View style={[s.cardDot, { backgroundColor: card.color }]} />
              <Text style={s.cardChipText}>{card.name}</Text>
              <TouchableOpacity onPress={() => removeCard(card.id)}>
                <Text style={s.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TextInput
          style={s.input}
          placeholder="Add a card (e.g. Chase Sapphire...)"
          placeholderTextColor="#64748b"
          value={cardSearch}
          onChangeText={t => { setCardSearch(t); setShowCardDropdown(true); }}
          onFocus={() => setShowCardDropdown(true)}
        />
        {showCardDropdown && filteredCards.length > 0 && (
          <View style={s.dropdown}>
            {filteredCards.slice(0, 6).map(card => (
              <TouchableOpacity key={card.id} style={s.dropdownItem} onPress={() => addCard(card)}>
                <View style={[s.cardDot, { backgroundColor: card.color }]} />
                <View>
                  <Text style={s.dropdownItemTitle}>{card.name}</Text>
                  <Text style={s.dropdownItemSub}>{card.issuer} · {card.base_rate}% base</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Merchant input */}
      <View style={s.section}>
        <Text style={s.label}>Where are you shopping?</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Amazon, Costco, Starbucks..."
          placeholderTextColor="#64748b"
          value={merchantQuery}
          onChangeText={t => {
            setMerchantQuery(t);
            setShowMerchantDropdown(true);
            setRecommendations(null);
            setShowCategoryPicker(false);
          }}
          onFocus={() => setShowMerchantDropdown(true)}
          returnKeyType="search"
          onSubmitEditing={() => findBestCard()}
        />
        {showMerchantDropdown && merchantSuggestions.length > 0 && (
          <View style={s.dropdown}>
            {merchantSuggestions.map(m => (
              <TouchableOpacity
                key={m.id}
                style={s.dropdownItem}
                onPress={() => { setMerchantQuery(m.name); setShowMerchantDropdown(false); }}
              >
                <Text style={s.emoji}>{m.category_icon}</Text>
                <View>
                  <Text style={s.dropdownItemTitle}>{m.name}</Text>
                  <Text style={s.dropdownItemSub}>{m.category_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Find button */}
      <TouchableOpacity
        style={[s.findBtn, (loading || !merchantQuery || selectedCards.length === 0) && s.findBtnDisabled]}
        onPress={() => findBestCard()}
        disabled={loading || !merchantQuery || selectedCards.length === 0}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.findBtnText}>Find Best Card</Text>
        }
      </TouchableOpacity>

      {/* Category picker for unknown merchants */}
      {showCategoryPicker && (
        <View style={s.categoryPicker}>
          <Text style={s.categoryPickerTitle}>
            ⚠️ We don't recognize "{merchantQuery}". What type of store is it?
          </Text>
          <View style={s.categoryGrid}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={s.categoryItem}
                onPress={() => findBestCard(cat.id)}
              >
                <Text style={s.categoryIcon}>{cat.icon}</Text>
                <Text style={s.categoryName}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results */}
      {recommendations && merchantMatch && (
        <View style={s.results}>
          <Text style={s.resultsTitle}>
            Best cards for <Text style={s.resultsHighlight}>{merchantMatch.merchantName}</Text>
            {merchantMatch.categoryName ? <Text style={s.resultsSub}> · {merchantMatch.categoryName}</Text> : null}
          </Text>

          {recommendations.map((rec, idx) => (
            <View key={rec.cardId} style={[s.recCard, idx === 0 && s.recCardBest]}>
              {idx === 0 && (
                <View style={s.bestBadge}>
                  <Text style={s.bestBadgeText}>⭐ Best Choice</Text>
                </View>
              )}
              <View style={s.recRow}>
                <View style={[s.recIcon, { backgroundColor: rec.color + '22', borderColor: rec.color + '44' }]}>
                  <Text style={{ color: rec.color, fontSize: 18 }}>💳</Text>
                </View>
                <View style={s.recInfo}>
                  <Text style={s.recName}>{rec.cardName}</Text>
                  <Text style={s.recIssuer}>{rec.issuer}</Text>
                </View>
                <View style={s.recRate}>
                  <Text style={[s.recRateText, { color: idx === 0 ? '#818cf8' : '#94a3b8' }]}>
                    {formatReward(rec)}
                  </Text>
                  {formatEffective(rec) && (
                    <Text style={s.recEffective}>{formatEffective(rec)}</Text>
                  )}
                  {rec.category && <Text style={s.recCategory}>{rec.category}</Text>}
                </View>
              </View>

              {rec.requiresActivation && (
                <Text style={s.notice}>⚠️ Requires activation on issuer's website</Text>
              )}
              {rec.spendCap && (
                <Text style={s.notice}>💡 ${rec.spendCap.toLocaleString()} {rec.capPeriod}ly spend cap</Text>
              )}
              {rec.notes && <Text style={s.notice}>ℹ️ {rec.notes}</Text>}
              {rec.isRotating && rec.validUntil && (
                <Text style={s.notice}>
                  🔄 Valid until {new Date(rec.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 2 },
  headerSub: { fontSize: 13, color: '#94a3b8' },
  signInBtn: {
    backgroundColor: '#1e293b', borderRadius: 20, borderWidth: 1,
    borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 7,
  },
  signInText: { color: '#e2e8f0', fontSize: 13, fontWeight: '500' },
  userBtn: { padding: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarInitial: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#4f46e5',
    color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 36,
  },
  section: { marginHorizontal: 20, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1,
    borderColor: '#334155', color: '#fff', paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14,
  },
  selectedCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e293b', borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  cardDot: { width: 8, height: 8, borderRadius: 4 },
  cardChipText: { color: '#e2e8f0', fontSize: 12, fontWeight: '500' },
  removeBtn: { color: '#64748b', fontSize: 12, marginLeft: 2 },
  dropdown: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1,
    borderColor: '#334155', marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#273548',
  },
  dropdownItemTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '500' },
  dropdownItemSub: { color: '#64748b', fontSize: 11 },
  emoji: { fontSize: 18 },
  findBtn: {
    marginHorizontal: 20, backgroundColor: '#4f46e5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  findBtnDisabled: { opacity: 0.4 },
  findBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  categoryPicker: {
    marginHorizontal: 20, backgroundColor: '#1e293b', borderRadius: 16,
    borderWidth: 1, borderColor: '#f59e0b44', padding: 16, marginBottom: 16,
  },
  categoryPickerTitle: { color: '#fbbf24', fontSize: 13, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#273548', borderRadius: 10, paddingHorizontal: 10,
    paddingVertical: 7, borderWidth: 1, borderColor: '#334155',
  },
  categoryIcon: { fontSize: 14 },
  categoryName: { color: '#cbd5e1', fontSize: 12 },
  results: { marginHorizontal: 20 },
  resultsTitle: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  resultsHighlight: { color: '#fff', fontWeight: '600' },
  resultsSub: { color: '#64748b' },
  recCard: {
    backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1,
    borderColor: '#334155', padding: 14, marginBottom: 10,
  },
  recCardBest: { borderColor: '#6366f188', backgroundColor: '#6366f111' },
  bestBadge: {
    backgroundColor: '#4f46e5', borderRadius: 20, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  bestBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recIcon: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
  },
  recInfo: { flex: 1 },
  recName: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  recIssuer: { color: '#64748b', fontSize: 11 },
  recRate: { alignItems: 'flex-end' },
  recRateText: { fontSize: 17, fontWeight: '700' },
  recEffective: { color: '#34d399', fontSize: 11, fontWeight: '500' },
  recCategory: { color: '#64748b', fontSize: 10 },
  notice: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
});
