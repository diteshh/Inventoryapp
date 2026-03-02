import { useTheme } from '@/lib/theme-context';
import { Tabs } from 'expo-router';
import { Home, Package, QrCode, Layers, Menu } from 'lucide-react-native';
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
            <ScannerTabButton onPress={props.onPress ? () => (props.onPress as any)() : undefined} accentColor={colors.accent}>
              <QrCode color={colors.accentOnAccent} size={26} />
            </ScannerTabButton>
          ),
        }}
      />
      <Tabs.Screen
        name="pick-lists"
        options={{
          title: 'Workflows',
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
