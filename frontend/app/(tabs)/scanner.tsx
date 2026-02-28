import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import { notificationSuccess } from '@/lib/haptics';
import { router } from 'expo-router';
import { FlashlightOff, Flashlight, X, Package, QrCode, Search } from 'lucide-react-native';
import React, { useRef, useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Only import CameraView on native
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const Camera = require('expo-camera');
    CameraView = Camera.CameraView;
    useCameraPermissions = Camera.useCameraPermissions;
  } catch {
    // Camera not available
  }
}

function WebScannerFallback() {
  const [barcode, setBarcode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [foundItem, setFoundItem] = useState<Item | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleSearch = async () => {
    const query = barcode.trim();
    if (!query) return;
    setProcessing(true);
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', query)
      .eq('status', 'active')
      .limit(1);
    setProcessing(false);
    if (items && items.length > 0) {
      setFoundItem(items[0] as Item);
      setShowResult(true);
    } else {
      Alert.alert(
        'Barcode Not Found',
        `No item found for barcode: ${query}\n\nWould you like to create a new item?`,
        [
          { text: 'Create Item', onPress: () => router.push({ pathname: '/item/add', params: { barcode: query } }) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 px-6" style={{ backgroundColor: COLORS.navy }}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center">
        <View className="items-center mb-8">
          <View
            className="items-center justify-center rounded-full mb-4"
            style={{ width: 80, height: 80, backgroundColor: `${COLORS.teal}22` }}>
            <QrCode color={COLORS.teal} size={40} />
          </View>
          <Text className="text-xl font-bold text-white mb-1">Barcode Lookup</Text>
          <Text className="text-sm text-center" style={{ color: COLORS.textSecondary }}>
            Camera scanning is only available in the mobile app.{'\n'}Enter a barcode or SKU below.
          </Text>
        </View>

        <View
          className="flex-row items-center rounded-2xl px-4 py-3 mb-4"
          style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          <Search color={COLORS.textSecondary} size={18} />
          <TextInput
            className="flex-1 ml-3 text-base text-white"
            placeholder="Enter barcode or SKU..."
            placeholderTextColor={COLORS.textSecondary}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {barcode.length > 0 && (
            <TouchableOpacity onPress={() => setBarcode('')}>
              <X color={COLORS.textSecondary} size={16} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSearch}
          disabled={processing || !barcode.trim()}
          className="items-center justify-center rounded-2xl py-4"
          style={{ backgroundColor: barcode.trim() ? COLORS.teal : `${COLORS.teal}44` }}>
          {processing ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <Text className="font-bold text-base" style={{ color: COLORS.navy }}>
              Search
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Found Item Modal */}
      <Modal visible={showResult} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: COLORS.navyCard }}>
            <Text className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.teal }}>
              Item Found
            </Text>
            {foundItem && (
              <>
                <View className="mb-4 flex-row items-center gap-4">
                  {foundItem.photos?.[0] ? (
                    <Image
                      source={{ uri: foundItem.photos[0] }}
                      style={{ width: 72, height: 72, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="items-center justify-center rounded-xl" style={{ width: 72, height: 72, backgroundColor: COLORS.navy }}>
                      <Package color={COLORS.textSecondary} size={28} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-white">{foundItem.name}</Text>
                    {foundItem.sku && (
                      <Text className="text-xs font-mono mt-0.5" style={{ color: COLORS.textSecondary }}>
                        SKU: {foundItem.sku}
                      </Text>
                    )}
                    <Text className="text-sm mt-1 font-medium" style={{ color: COLORS.teal }}>
                      Stock: {foundItem.quantity} units
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => { setShowResult(false); setBarcode(''); setFoundItem(null); }}
                    className="flex-1 items-center justify-center rounded-xl py-3.5"
                    style={{ backgroundColor: COLORS.navy }}>
                    <Text className="font-semibold" style={{ color: COLORS.textSecondary }}>Search Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowResult(false); router.push(`/item/${foundItem.id}`); }}
                    className="flex-1 items-center justify-center rounded-xl py-3.5"
                    style={{ backgroundColor: COLORS.teal }}>
                    <Text className="font-bold" style={{ color: COLORS.navy }}>View Item</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NativeScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [foundItem, setFoundItem] = useState<Item | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarcodeScan = async ({ data }: { data: string; type: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    notificationSuccess();

    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', data)
      .eq('status', 'active')
      .limit(1);

    setProcessing(false);
    if (items && items.length > 0) {
      setFoundItem(items[0] as Item);
      setShowResult(true);
    } else {
      Alert.alert(
        'Barcode Not Found',
        `No item found for barcode: ${data}\n\nWould you like to create a new item?`,
        [
          { text: 'Create Item', onPress: () => router.push({ pathname: '/item/add', params: { barcode: data } }) },
          { text: 'Scan Again', onPress: () => setScanned(false) },
        ]
      );
    }
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
        <ActivityIndicator color={COLORS.teal} size="large" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: COLORS.navy }}>
        <Package color={COLORS.textSecondary} size={48} className="mb-4" />
        <Text className="mb-2 text-center text-lg font-bold text-white">Camera Permission Required</Text>
        <Text className="mb-6 text-center text-sm" style={{ color: COLORS.textSecondary }}>
          Allow camera access to scan barcodes and QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="rounded-xl px-6 py-3.5"
          style={{ backgroundColor: COLORS.teal }}>
          <Text className="font-bold" style={{ color: COLORS.navy }}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#000' }}>
      <CameraView
        className="flex-1"
        facing="back"
        enableTorch={flashOn}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix'],
        }}>
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="rounded-full p-2.5"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <X color="#fff" size={22} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-white">Barcode Scanner</Text>
            <TouchableOpacity
              onPress={() => setFlashOn((f) => !f)}
              className="rounded-full p-2.5"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              {flashOn ? <FlashlightOff color="#fff" size={22} /> : <Flashlight color="#fff" size={22} />}
            </TouchableOpacity>
          </View>

          <View className="flex-1 items-center justify-center">
            <View style={{ width: 280, height: 200 }}>
              {[
                { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
                { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
                { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
                { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
              ].map((style, i) => (
                <View
                  key={i}
                  style={{ position: 'absolute', width: 30, height: 30, borderColor: COLORS.teal, ...style }}
                />
              ))}
              {!scanned && (
                <View
                  className="mx-2"
                  style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: COLORS.teal, opacity: 0.8 }}
                />
              )}
              {processing && (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color={COLORS.teal} size="large" />
                </View>
              )}
            </View>
            <Text className="mt-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Point camera at a barcode or QR code
            </Text>
          </View>

          {scanned && !processing && (
            <View className="mb-8 items-center">
              <TouchableOpacity
                onPress={() => { setScanned(false); setFoundItem(null); }}
                className="rounded-xl px-6 py-3.5"
                style={{ backgroundColor: COLORS.teal }}>
                <Text className="font-bold" style={{ color: COLORS.navy }}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </CameraView>

      <Modal visible={showResult} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: COLORS.navyCard }}>
            <Text className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.teal }}>
              Item Found
            </Text>
            {foundItem && (
              <>
                <View className="mb-4 flex-row items-center gap-4">
                  {foundItem.photos?.[0] ? (
                    <Image
                      source={{ uri: foundItem.photos[0] }}
                      style={{ width: 72, height: 72, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="items-center justify-center rounded-xl" style={{ width: 72, height: 72, backgroundColor: COLORS.navy }}>
                      <Package color={COLORS.textSecondary} size={28} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-white">{foundItem.name}</Text>
                    {foundItem.sku && (
                      <Text className="text-xs font-mono mt-0.5" style={{ color: COLORS.textSecondary }}>
                        SKU: {foundItem.sku}
                      </Text>
                    )}
                    <Text className="text-sm mt-1 font-medium" style={{ color: COLORS.teal }}>
                      Stock: {foundItem.quantity} units
                    </Text>
                    {foundItem.location && (
                      <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                        {foundItem.location}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => { setShowResult(false); setScanned(false); }}
                    className="flex-1 items-center justify-center rounded-xl py-3.5"
                    style={{ backgroundColor: COLORS.navy }}>
                    <Text className="font-semibold" style={{ color: COLORS.textSecondary }}>Scan Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowResult(false); router.push(`/item/${foundItem.id}`); }}
                    className="flex-1 items-center justify-center rounded-xl py-3.5"
                    style={{ backgroundColor: COLORS.teal }}>
                    <Text className="font-bold" style={{ color: COLORS.navy }}>View Item</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function ScannerScreen() {
  if (Platform.OS === 'web') {
    return <WebScannerFallback />;
  }
  return <NativeScanner />;
}
