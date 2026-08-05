interface HeadingProps {
  title: string;
  description: string;
}

export const Heading: React.FC<HeadingProps> = ({ title, description }) => {
  return (
    <div>
      <h2 className='font-serif text-3xl font-medium tracking-tight'>
        {title}
      </h2>
      <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
    </div>
  );
};
