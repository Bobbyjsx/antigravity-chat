import { Loader } from 'lucide-react';

export const PageLoader = () => {
  return (
    <div className='flex h-screen w-screen items-center justify-center bg-gray-800'>
      <div className='flex flex-col items-center justify-center'>
        <Loader
          className='text-gray-100 motion-safe:animate-spin'
          size={40}
        />
      </div>
    </div>
  );
};
