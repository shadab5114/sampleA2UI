import HomeClient from '@/components/store/HomeClient';
import products from '@/lib/data/products.json';

export default function HomePage() {
  return <HomeClient products={products} />;
}
