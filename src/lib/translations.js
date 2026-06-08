// Arabic translations for the QPC Dashboard UI

export const AR = {
  // Navigation
  nav: {
    overview:     'نظرة عامة',
    people:       'الأشخاص',
    competitions: 'المنافسات',
    dashboard:    'لوحة التحكم',
    athletes:     'الرياضيون',
    coaches:      'المدربون',
    employees:    'الموظفون',
    sports:       'الرياضات',
    events:       'الفعاليات',
    results:      'النتائج',
    signOut:      'تسجيل الخروج',
    adminPortal:  'بوابة الإدارة',
    season:       'موسم',
  },

  // Page titles
  pages: {
    dashboard:  'لوحة التحكم',
    athletes:   'الرياضيون',
    coaches:    'المدربون',
    employees:  'الموظفون',
    sports:     'الرياضات',
    events:     'الفعاليات',
    results:    'النتائج',
  },

  // Dashboard
  dashboard: {
    totalAthletes:    'إجمالي الرياضيين',
    activeEvents:     'الفعاليات النشطة',
    coaches:          'المدربون',
    goldMedals:       'الميداليات الذهبية',
    activeThisSeason: 'نشط هذا الموسم',
    upcoming:         'قادم',
    sportsCovered:    'رياضات مشمولة',
    seasonTotal:      'إجمالي الموسم',
    upcomingEvents:   'الفعاليات القادمة',
    medalLeaders:     'قادة الميداليات',
    sportsBreakdown:  'تفاصيل الرياضات',
    clickToExplore:   'انقر للاستكشاف',
  },

  // Common actions
  actions: {
    add:          'إضافة',
    edit:         'تعديل',
    delete:       'حذف',
    save:         'حفظ',
    cancel:       'إلغاء',
    back:         'رجوع',
    search:       'بحث',
    export:       'تصدير',
    exportExcel:  'تصدير Excel',
    exportPDF:    'تصدير PDF',
    generateCard: 'إنشاء بطاقة',
    upload:       'رفع',
    download:     'تنزيل',
    resetFilters: 'إعادة تعيين الفلاتر',
    saveChanges:  'حفظ التغييرات',
    addRecord:    'إضافة سجل',
    editList:     'تعديل القائمة',
    columns:      'الأعمدة',
    print:        'طباعة',
  },

  // Table headers — Athletes
  athletes: {
    athlete:        'الرياضي',
    sport:          'الرياضة',
    classification: 'التصنيف',
    nationality:    'الجنسية',
    coach:          'المدرب',
    status:         'الحالة',
    medals:         'الميداليات',
    documents:      'الوثائق',
    gender:         'الجنس',
    dob:            'تاريخ الميلاد',
    disability:     'الإعاقة',
    arabicName:     'الاسم بالعربية',
    phone:          'الهاتف',
    email:          'البريد الإلكتروني',
    joinedQPC:      'تاريخ الانضمام',
    passportNo:     'رقم الجواز',
    passportExpiry: 'انتهاء الجواز',
    qatarID:        'الرقم الشخصي',
    bloodType:      'فصيلة الدم',
    ageCategory:    'الفئة العمرية',
    medicalStatus:  'الحالة الطبية',
    qssNumber:      'رقم QSS',
    careerProfile:  'رقم المسار',
    idExpiry:       'انتهاء الهوية',
    addAthlete:     'إضافة رياضي',
  },

  // Table headers — Coaches
  coaches: {
    coach:       'المدرب',
    sport:       'الرياضة',
    certLevel:   'مستوى الشهادة',
    nationality: 'الجنسية',
    athletes:    'الرياضيون',
    status:      'الحالة',
    employeeNum: 'رقم الموظف',
    addCoach:    'إضافة مدرب',
  },

  // Table headers — Employees
  employees: {
    employee:    'الموظف',
    designation: 'المسمى الوظيفي',
    nationality: 'الجنسية',
    gender:      'الجنس',
    employeeNum: 'رقم الموظف',
    qssNum:      'رقم QSS',
    status:      'الحالة',
    addEmployee: 'إضافة موظف',
  },

  // Table headers — Events
  events: {
    event:        'الفعالية',
    sport:        'الرياضة',
    venue:        'المكان',
    date:         'التاريخ',
    participants: 'المشاركون',
    status:       'الحالة',
    addEvent:     'إضافة فعالية',
  },

  // Table headers — Results
  results: {
    medal:      'الميدالية',
    athlete:    'الرياضي',
    discipline: 'التخصص',
    competition:'المنافسة',
    result:     'النتيجة',
    date:       'التاريخ',
    addResult:  'إضافة نتيجة',
  },

  // Statuses
  status: {
    active:              'نشط',
    inactive:            'غير نشط',
    suspended:           'موقوف',
    underMedicalReview:  'تحت المراجعة الطبية',
    injured:             'مصاب',
    retired:             'متقاعد',
    onLeave:             'في إجازة',
    upcoming:            'قادم',
    completed:           'مكتمل',
    registrationOpen:    'التسجيل مفتوح',
    planning:            'قيد التخطيط',
  },

  // Medals
  medals: {
    gold:   'ذهب',
    silver: 'فضة',
    bronze: 'برونز',
  },

  // Profile sections
  profile: {
    personalInfo:      'المعلومات الشخصية',
    sportClassification:'الرياضة والتصنيف',
    passportID:        'الجواز والهوية',
    emergencyContact:  'جهة الاتصال في حالات الطوارئ',
    medicalInfo:       'المعلومات الطبية',
    clubRole:          'النادي والدور',
    headCoach:         'المدرب الرئيسي',
    medalCount:        'عدد الميداليات',
    personalBests:     'أفضل الإنجازات',
    competitionHistory:'سجل المنافسات',
    notes:             'ملاحظات',
    documents:         'الوثائق',
    recentResults:     'النتائج الأخيرة',
    assignedAthletes:  'الرياضيون المعينون',
    yearsOld:          'سنة',
    withQPC:           'مع QPC',
    noCoachAssigned:   'لم يتم تعيين مدرب',
    clickToView:       'انقر للعرض',
  },

  // Filters
  filters: {
    allSports:        'جميع الرياضات',
    allStatuses:      'جميع الحالات',
    allGenders:       'جميع الأجناس',
    allNationalities: 'جميع الجنسيات',
    allDesignations:  'جميع المسميات',
    allCoaches:       'جميع المدربين',
    searchAthletes:   'بحث عن رياضي...',
    searchCoaches:    'بحث عن مدرب...',
    searchEmployees:  'بحث عن موظف...',
  },

  // Confirm dialogs
  confirm: {
    deleteAthlete:  'حذف الرياضي؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteCoach:    'حذف المدرب؟ سيتم إلغاء تعيين الرياضيين.',
    deleteEmployee: 'حذف الموظف؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteEvent:    'حذف الفعالية؟',
    deleteResult:   'حذف النتيجة؟ سيتم تحديث عدد الميداليات.',
    deleteDocument: 'حذف الوثيقة؟ لا يمكن التراجع عن هذا الإجراء.',
    delete:         'حذف',
    cancel:         'إلغاء',
  },

  // Empty states
  empty: {
    noAthletes:    'لا يوجد رياضيون',
    noCoaches:     'لا يوجد مدربون',
    noEmployees:   'لا يوجد موظفون',
    noEvents:      'لا توجد فعاليات',
    noResults:     'لا توجد نتائج',
    noDocuments:   'لم يتم رفع وثائق بعد.',
    noMedals:      'لا توجد ميداليات بعد',
    noCoachAssigned: 'لم يتم تعيين مدرب',
    notRegistered: 'لم يتم التسجيل في أي فعاليات بعد.',
  },

  // Sports names
  sports: {
    Athletics:          'ألعاب القوى',
    Swimming:           'السباحة',
    Powerlifting:       'رفع الأثقال',
    Boccia:             'البوتشيا',
    Goalball:           'كرة الهدف',
    'Table Tennis':     'تنس الطاولة',
    'Special Olympics': 'الأولمبياد الخاص',
    Shooting:           'الرماية',
    'Wheelchair Tennis':'تنس الكراسي المتحركة',
  },
}

export default AR
