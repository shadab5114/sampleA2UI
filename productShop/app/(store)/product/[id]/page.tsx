import { notFound } from 'next/navigation';
import StoreSurface from '@/components/a2ui/StoreSurface';
import products from '@/lib/data/products.json';
import productSurface from '@/surfaces/product.a2ui.json';
import { A2uiMessage } from '@/lib/a2ui/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  const messages: A2uiMessage[] = [
    { updateDataModel: { surfaceId: 'product', path: '/', value: product } },
    ...(productSurface as A2uiMessage[]),
  ];

  return <StoreSurface messages={messages} />;
}
