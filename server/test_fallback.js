const SERVICE_TEMPLATES = {
    'أطفال': ['كشف عام', 'استشارة', 'متابعة نمو', 'تطعيمات', 'حساسية صدر'],
    'أسنان': ['كشف', 'استشارة', 'خلع', 'حشو عصب', 'حشو عادي', 'زراعة أسنان', 'تقويم أسنان', 'تبييض أسنان', 'تنظيف جير', 'طقم أسنان']
};

function getServicesList(clinic) {
    let servicesList = clinic.clinic_services && clinic.clinic_services.length > 0
        ? clinic.clinic_services.map(s => s.name).join('، ')
        : '';

    if (!servicesList) {
        const templates = SERVICE_TEMPLATES[clinic.specialty] || [];
        if (templates.length > 0) {
            servicesList = templates.join('، ');
        } else {
            servicesList = 'الكشف العام (لم يتم تحديد خدمات متخصصة بعد)';
        }
    }
    return servicesList;
}

// Test cases
const clinic1 = { specialty: 'أطفال', clinic_services: [] };
const clinic2 = { specialty: 'أسنان', clinic_services: [{ name: 'خدمة مخصصة' }] };
const clinic3 = { specialty: 'غير معروف', clinic_services: [] };

console.log("Clinic 1 (أطفال - empty):", getServicesList(clinic1));
console.log("Clinic 2 (أسنان - custom):", getServicesList(clinic2));
console.log("Clinic 3 (Unknown - empty):", getServicesList(clinic3));
