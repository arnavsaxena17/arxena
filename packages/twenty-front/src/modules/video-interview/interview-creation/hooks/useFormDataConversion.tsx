export const useFormDataConversion = () => {
  const obj: any = {};
  const convertFormData = (formData: FormData) => {
    console.log("formData  ", formData);
    for (const [key, value] of formData.entries()) {
      const keys = key.split(/\[|\]/).filter((k) => k); // Split keys by [ and remove empty strings
      keys.reduce((acc, k, i) => {
        if (i === keys.length - 1) {
          acc[k] = value;
        } else {
          acc[k] = acc[k] || (isNaN(Number(keys[i + 1])) ? {} : []); // Check if next key is an index
        }
        return acc[k];
      }, obj);
    }

    console.log(obj);

    const introduction: any = obj.newVideoInterviewTemplate[0];

    const questions: any[] = [];

    for (let i = 1; i < obj.newVideoInterviewTemplate.length; i++) {
      questions.push(obj.newVideoInterviewTemplate[i]);
    }
    console.log("Questions::", questions);
    return { introduction, questions };
  };

  return {
    convertFormData,
  };
};
