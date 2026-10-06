import { notFound } from 'next/navigation';
import { NAV_ITEMS } from '../../../components/dashboard/nav';
import FeatureModule from '../../../components/dashboard/FeatureModule';

export const dynamicParams = false;

export function generateStaticParams() {
  return NAV_ITEMS.filter((item) => item.slug).map((item) => ({
    section: item.slug,
  }));
}

async function findItem(params) {
  const { section } = await params;
  const item = NAV_ITEMS.find((entry) => entry.slug === section);
  if (!item) notFound();
  return item;
}

export async function generateMetadata({ params }) {
  const item = await findItem(params);
  return { title: item.title };
}

export default async function FeaturePage({ params }) {
  const item = await findItem(params);
  return <FeatureModule section={item.slug} />;
}
