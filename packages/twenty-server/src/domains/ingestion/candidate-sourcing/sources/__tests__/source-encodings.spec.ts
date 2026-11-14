import { DataSourceType } from 'src/domains/ingestion/candidate-sourcing/services/data-source-transformer-factory.service';
import {
  sourceOfImportFormat,
  sourceOfOrgChartCandidateSource,
  sourceOfTabRow,
} from 'src/domains/ingestion/candidate-sourcing/sources/source-encodings';

describe('source encodings', () => {
  it('should read an org-chart candidate source as a registry source', () => {
    expect(sourceOfOrgChartCandidateSource('unipile').alias).toBe('linkedin');
    expect(sourceOfOrgChartCandidateSource('linkedin_xray').alias).toBe('xray');
    expect(sourceOfOrgChartCandidateSource('m7kq').alias).toBe('apollo');
    expect(sourceOfOrgChartCandidateSource('apollo').alias).toBe('apollo');
    expect(sourceOfOrgChartCandidateSource('harvest').alias).toBe('harvest');
  });

  it('should give a LinkedIn import format its source and a job board export none', () => {
    expect(sourceOfImportFormat(DataSourceType.LINKEDIN_SEARCH)?.alias).toBe(
      'linkedin',
    );
    expect(
      sourceOfImportFormat(DataSourceType.LINKEDIN_RECRUITER_LITE)?.alias,
    ).toBe('recruiter');
    expect(sourceOfImportFormat(DataSourceType.LINKEDIN_XRAY)?.alias).toBe(
      'xray',
    );
    expect(sourceOfImportFormat(DataSourceType.RESDEX_NAUKRI)).toBeUndefined();
    expect(sourceOfImportFormat(DataSourceType.PARSED_CV)).toBeUndefined();
  });

  it('should cover every import format', () => {
    for (const format of Object.values(DataSourceType)) {
      expect(() => sourceOfImportFormat(format)).not.toThrow();
    }
  });

  it('should read a tab row source directly, and an old "other" row as unknown', () => {
    expect(sourceOfTabRow('index')?.alias).toBe('index');
    expect(sourceOfTabRow('wikidata')?.label).toBe('Wikidata');
    expect(sourceOfTabRow('bright_data')?.alias).toBe('bright_data');
    expect(sourceOfTabRow('other')).toBeUndefined();
  });
});
