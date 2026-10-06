import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { NAV_ITEMS } from '../../../components/dashboard/nav';
import { Card, EmptyState, PageHeader } from '../../../components/dashboard/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return NAV_ITEMS.filter((item) => item.slug && !item.ready).map((item) => ({
    section: item.slug,
  }));
}

async function findItem(params) {
  const { section } = await params;
  const item = NAV_ITEMS.find(
    (entry) => entry.slug === section && !entry.ready,
  );
  if (!item) notFound();
  return item;
}

export async function generateMetadata({ params }) {
  const item = await findItem(params);
  return { title: item.title };
}

export default async function ComingSoonPage({ params }) {
  const item = await findItem(params);
  return (
    <>
      <PageHeader
        icon={item.icon}
        title={item.title}
        description={item.blurb}
      />
      <Card>
        <EmptyState icon={Hammer} title="This module is being built">
          {item.title} is not available in the dashboard yet. Nothing here is
          simulated: it will appear as soon as the bot supports it.
        </EmptyState>
        <div className="center">
          <Link className="button button-ghost" href="/dashboard">
            Back to overview
          </Link>
        </div>
      </Card>
    </>
  );
}
