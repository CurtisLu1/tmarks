interface PageInfoCardProps {
  title: string;
  url: string;
  description?: string;
  thumbnail?: string;
}

export function PageInfoCard({ title, url, description, thumbnail }: PageInfoCardProps) {

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Thumbnail section */}
      {thumbnail && (
        <div className="relative h-32 bg-gray-100 dark:bg-gray-700">
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content section */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className={`text-base font-semibold text-gray-900 dark:text-white line-clamp-2 ${thumbnail ? 'text-center' : ''}`}>
          {title}
        </h3>

        {/* URL */}
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={url}>
          {url}
        </p>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
