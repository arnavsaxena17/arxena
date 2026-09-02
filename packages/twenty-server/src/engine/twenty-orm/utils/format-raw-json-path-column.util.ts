import { isAllowedRawJsonPathKey } from 'twenty-shared/utils';

export const formatRawJsonPathColumnExpression = ({
  objectNameSingular,
  fieldName,
  jsonPath,
}: {
  objectNameSingular: string;
  fieldName: string;
  jsonPath: string;
}): string => {
  if (!isAllowedRawJsonPathKey(jsonPath)) {
    throw new Error(`Invalid RAW_JSON path key: ${jsonPath}`);
  }

  return `"${objectNameSingular}"."${fieldName}"->>'${jsonPath}'`;
};

export const formatRawJsonPathNumericColumnExpression = ({
  objectNameSingular,
  fieldName,
  jsonPath,
}: {
  objectNameSingular: string;
  fieldName: string;
  jsonPath: string;
}): string => {
  const textExpression = formatRawJsonPathColumnExpression({
    objectNameSingular,
    fieldName,
    jsonPath,
  });

  return `NULLIF(${textExpression}, '')::double precision`;
};

export const formatRawJsonPathDateTimeColumnExpression = ({
  objectNameSingular,
  fieldName,
  jsonPath,
}: {
  objectNameSingular: string;
  fieldName: string;
  jsonPath: string;
}): string => {
  const textExpression = formatRawJsonPathColumnExpression({
    objectNameSingular,
    fieldName,
    jsonPath,
  });

  return `NULLIF(${textExpression}, '')::timestamptz`;
};

export const formatRawJsonPathNotEmptyExpression = ({
  objectNameSingular,
  fieldName,
  jsonPath,
}: {
  objectNameSingular: string;
  fieldName: string;
  jsonPath: string;
}): string => {
  const textExpression = formatRawJsonPathColumnExpression({
    objectNameSingular,
    fieldName,
    jsonPath,
  });

  return `${textExpression} IS NOT NULL AND ${textExpression} <> ''`;
};
