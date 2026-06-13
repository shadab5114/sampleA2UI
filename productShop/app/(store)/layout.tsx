'use client';

import * as React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
} from '@mui/material';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { usePathname, useRouter } from 'next/navigation';
import { CartProvider, useCart } from '@/lib/cart/CartContext';
import { ChannelProvider } from '@/components/store/ChannelProvider';
import ChannelBar from '@/components/demo/ChannelBar';

function StoreNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();

  const navValue = pathname.startsWith('/chat')
    ? 'chat'
    : pathname.startsWith('/cart')
    ? 'cart'
    : 'home';

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <PhoneAndroidIcon sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            PhoneHub
          </Typography>
          <Typography variant="caption" color="inherit" sx={{ opacity: 0.7 }}>
            A2UI demo
          </Typography>
        </Toolbar>
      </AppBar>

      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
        <BottomNavigation
          value={navValue}
          onChange={(_, v) => {
            if (v === 'home') router.push('/');
            if (v === 'cart') router.push('/cart');
            if (v === 'chat') router.push('/chat');
          }}
        >
          <BottomNavigationAction label="Shop" value="home" icon={<PhoneAndroidIcon />} />
          <BottomNavigationAction
            label="Cart"
            value="cart"
            icon={
              <Badge badgeContent={count} color="primary" max={9}>
                <ShoppingCartOutlinedIcon />
              </Badge>
            }
          />
          <BottomNavigationAction label="Chat" value="chat" icon={<ChatBubbleOutlineIcon />} />
        </BottomNavigation>
      </Paper>
    </>
  );
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelProvider>
      <CartProvider>
        <Box sx={{ pb: 8, minHeight: '100vh' }}>
          <StoreNav />
          <ChannelBar />
          <Box component="main">{children}</Box>
        </Box>
      </CartProvider>
    </ChannelProvider>
  );
}
