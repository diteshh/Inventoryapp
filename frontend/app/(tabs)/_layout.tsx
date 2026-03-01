import { useTheme } from '@/lib/theme-context';
import { Tabs } from 'expo-router';
import { Home, Package, QrCode, ClipboardList, MoreHorizontal } from 'lucide-react-native';
import { View, TouchableOpacity } from 'react-native';

function ScannerTabButton({ children, onPress, accentColor }: { children: React.ReactNode; onPress?: () => void; accentColor: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="items-center justify-center"
      style={{ top: -14 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: accentColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scan',
          tabBarIcon: () => <QrCode color={colors.accentOnAccent} size={26} />,
          tabBarButton: (props) => (
            <ScannerTabButton onPress={props.onPress ?? undefined} accentColor={colors.accent}>
              <QrCode color={colors.accentOnAccent} size={26} />
            </ScannerTabButton>
          ),
        }}
      />
      <Tabs.Screen
        name="pick-lists"
        options={{
          title: 'Pick Lists',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
