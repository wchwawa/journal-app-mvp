'use client';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { IconSlash } from '@tabler/icons-react';
import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function Breadcrumbs() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;
  const pathname = usePathname();
  const parent = items.length > 1 ? items[items.length - 2] : null;

  return (
    <div className='flex items-center gap-2'>
      {parent && pathname !== parent.link ? (
        <Link
          href={parent.link}
          className='border-border inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium md:hidden'
          aria-label='Go back'
        >
          <ChevronLeft className='h-4 w-4' />
        </Link>
      ) : null}
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => (
            <Fragment key={item.title}>
              {index !== items.length - 1 && (
                <BreadcrumbItem className='hidden md:block'>
                  <BreadcrumbLink href={item.link}>{item.title}</BreadcrumbLink>
                </BreadcrumbItem>
              )}
              {index < items.length - 1 && (
                <BreadcrumbSeparator className='hidden md:block'>
                  <IconSlash />
                </BreadcrumbSeparator>
              )}
              {index === items.length - 1 && (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
