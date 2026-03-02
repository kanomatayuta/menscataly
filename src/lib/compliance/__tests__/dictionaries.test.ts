/**
 * 薬機法NGワード辞書 整合性テスト
 *
 * 辞書ファイル (src/lib/compliance/dictionaries/) が正しい構造を持ち、
 * 全エントリに必要なフィールドが揃っていることを検証する。
 * このテストは辞書ファイルのみに依存するため、チェッカー実装前から実行可能。
 */

import aGA from '../dictionaries/aga.json';
import eD from '../dictionaries/ed.json';
import hairRemoval from '../dictionaries/hair-removal.json';
import skincare from '../dictionaries/skincare.json';

const ALL_DICTS = [
  { name: 'aga', data: aGA },
  { name: 'ed', data: eD },
  { name: 'hair-removal', data: hairRemoval },
  { name: 'skincare', data: skincare },
] as const;

const VALID_SEVERITIES = ['high', 'medium', 'low'] as const;
const VALID_CATEGORIES = ['aga', 'ed', 'hair_removal', 'skincare'] as const;

describe('NGワード辞書 整合性テスト', () => {
  describe.each(ALL_DICTS)('$name 辞書', ({ name, data }) => {
    test('categoryフィールドが有効値であること', () => {
      expect(VALID_CATEGORIES).toContain(data.category);
    });

    test('descriptionが存在すること', () => {
      expect(data.description).toBeTruthy();
    });

    test('entriesが1件以上存在すること', () => {
      expect(data.entries.length).toBeGreaterThan(0);
    });

    test('全エントリにidが存在すること', () => {
      data.entries.forEach((entry) => {
        expect(entry.id).toBeTruthy();
        expect(typeof entry.id).toBe('string');
      });
    });

    test('idが重複していないこと', () => {
      const ids = data.entries.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('全エントリにng表現が存在すること', () => {
      data.entries.forEach((entry) => {
        expect(entry.ng).toBeTruthy();
        expect(typeof entry.ng).toBe('string');
      });
    });

    test('全エントリにok変換表現が存在すること', () => {
      data.entries.forEach((entry) => {
        expect(entry.ok).toBeTruthy();
        expect(typeof entry.ok).toBe('string');
      });
    });

    test('ng表現とok表現が異なること', () => {
      data.entries.forEach((entry) => {
        expect(entry.ok).not.toBe(entry.ng);
      });
    });

    test('全エントリにreasonが存在すること', () => {
      data.entries.forEach((entry) => {
        expect(entry.reason).toBeTruthy();
      });
    });

    test('全エントリのseverityが有効値であること', () => {
      data.entries.forEach((entry) => {
        expect(VALID_SEVERITIES).toContain(entry.severity);
      });
    });

    test('highのエントリが全体の50%以上を占めること (重要表現のカバレッジ確認)', () => {
      const highCount = data.entries.filter((e) => e.severity === 'high').length;
      const ratio = highCount / data.entries.length;
      expect(ratio).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('全辞書横断テスト', () => {
    test('全辞書合計エントリ数が40件以上あること', () => {
      const totalEntries = ALL_DICTS.reduce(
        (sum, { data }) => sum + data.entries.length,
        0
      );
      expect(totalEntries).toBeGreaterThanOrEqual(40);
    });

    test('全辞書でIDがグローバルに重複していないこと', () => {
      const allIds = ALL_DICTS.flatMap(({ data }) => data.entries.map((e) => e.id));
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    test('「副作用なし」がhigh severityとして登録されていること', () => {
      const agaEntry = aGA.entries.find((e) => e.ng === '副作用なし');
      expect(agaEntry).toBeDefined();
      expect(agaEntry?.severity).toBe('high');
    });

    test('「業界最安値」パターンが各辞書に含まれていること', () => {
      const agaHasPrice = aGA.entries.some((e) => e.ng.includes('業界最安値'));
      const edHasPrice = eD.entries.some((e) => e.ng.includes('業界最安値'));
      const hrHasPrice = hairRemoval.entries.some((e) => e.ng.includes('業界最安値'));
      expect(agaHasPrice).toBe(true);
      expect(edHasPrice).toBe(true);
      expect(hrHasPrice).toBe(true);
    });

    test('全エントリのok表現に「確実」「必ず」「完全」「100%」が含まれないこと', () => {
      const forbiddenInOk = ['確実', '必ず', '完全に', '100%'];
      ALL_DICTS.forEach(({ name, data }) => {
        data.entries.forEach((entry) => {
          forbiddenInOk.forEach((forbidden) => {
            // ok表現にNG断定表現が混入していないことを確認
            if (entry.ok.includes(forbidden)) {
              // 「個人差があります」等の注釈付きの場合は許容
              const hasDisclaimer = entry.ok.includes('個人差') || entry.ok.includes('場合があります');
              expect(hasDisclaimer).toBe(true);
            }
          });
        });
      });
    });
  });
});
