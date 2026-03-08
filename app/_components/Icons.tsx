export function FolderIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.33366 10.6668H0.666992V2.00016H1.33366V1.3335H6.00033V2.00016H6.66699V2.66683H12.667V3.3335H13.3337V6.00016H3.33366V6.66683H2.66699V8.00016H2.00033V9.3335H1.33366V10.6668Z"
        fill="currentColor"
      />
      <path
        d="M15.333 6.6665V7.99984H14.6663V9.33317H13.9997V10.6665H13.333V11.9998H12.6663V13.9998H11.9997V14.6665H1.99967V13.9998H1.33301V11.9998H1.99967V10.6665H2.66634V9.33317H3.33301V7.99984H3.99967V6.6665H15.333Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FileIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4.00033 2.66683H2.66699V13.3335H4.00033V2.66683ZM10.667 1.3335H2.66699V2.66683H10.667V1.3335ZM13.3337 4.00016H12.0003V13.3335H13.3337V4.00016ZM13.3337 13.3335H2.66699V14.6668H13.3337V13.3335ZM10.667 2.66683H12.0003V4.00016H10.667V2.66683ZM8.00033 2.66683H9.33366V6.66683H8.00033V2.66683Z"
        fill="currentColor"
      />
      <path
        d="M8.00065 5.3335H12.0007V6.66683H8.00065V5.3335ZM5.33398 10.6668H10.6673V12.0002H5.33398V10.6668ZM5.33398 8.00016H10.6673V9.3335H5.33398V8.00016ZM5.33398 5.3335H6.66732V6.66683H5.33398V5.3335Z"
        fill="currentColor"
      />
    </svg>
  );
}
