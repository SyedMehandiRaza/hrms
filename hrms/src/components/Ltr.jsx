// Wrap IDs, codes, emails, phone numbers, amounts, dates — anything that must
// stay left-to-right even inside an Arabic (RTL) layout.
// Usage: <Ltr>{employee.country_emp_id}</Ltr> or <Ltr as="td">...</Ltr>
export default function Ltr({ as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag dir="ltr" className={`ltr ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
