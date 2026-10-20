// Fixed merge-field catalogue (plan decision 44). A template may use the tokens of its own
// audience plus the Contract group. Stored on fields as db_source + db_column (token).
// Labels reuse the UI's builder labels where the token already existed there.

const MERGE_FIELDS = Object.freeze({
  EMPLOYEE: [
    { token: "employee_name", label: "Full Name" },
    { token: "employee_email", label: "Email" },
    { token: "employee_phone", label: "Phone" },
    { token: "employee_code", label: "Employee Code" },
    { token: "designation", label: "Designation" },
    { token: "department", label: "Department" },
    { token: "project", label: "Project" },
    { token: "staffing_company", label: "Staffing Company" },
    { token: "joining_date", label: "Joining Date" },
    { token: "employment_type", label: "Employment Type" },
    { token: "nationality", label: "Nationality" },
    { token: "gender", label: "Gender" },
    { token: "dob", label: "Date of Birth" },
    { token: "address", label: "Address" },
    { token: "shift", label: "Shift" },
    { token: "company_name", label: "Company Name" },
  ],
  STAFFING_COMPANY: [
    { token: "company_name", label: "Company Name" },
    { token: "company_code", label: "Company Code" },
    { token: "company_email", label: "Company Email" },
    { token: "company_phone", label: "Company Phone" },
    { token: "contact_person_name", label: "Contact Person" },
    { token: "contact_person_email", label: "Contact Email" },
    { token: "contact_person_phone", label: "Contact Phone" },
    { token: "city", label: "City" },
    { token: "address", label: "Address" },
    { token: "employer_name", label: "Employer Name" },
  ],
  CONTRACT: [
    { token: "contract_no", label: "Contract No" },
    { token: "contract_type", label: "Contract Type" },
    { token: "start_date", label: "Start Date" },
    { token: "end_date", label: "End Date" },
    { token: "rate", label: "Rate" },
    { token: "notice_period", label: "Notice Period" },
    { token: "sent_date", label: "Sent Date" },
  ],
});

const GROUP_NAMES = Object.freeze({ EMPLOYEE: "Employee", STAFFING_COMPANY: "Staffing Company", CONTRACT: "Contract" });

// The groups a template of this audience may use.
const groupsFor = (audience) => [audience, "CONTRACT"].map((source) => ({ source, group: GROUP_NAMES[source], fields: MERGE_FIELDS[source] }));

// The catalogue entry for db_source + db_column, if a template of `audience` may use it.
const findMergeField = (audience, source, token) => {
  if (source !== audience && source !== "CONTRACT") return null;
  return (MERGE_FIELDS[source] || []).find((f) => f.token === token) || null;
};

module.exports = { MERGE_FIELDS, groupsFor, findMergeField };
