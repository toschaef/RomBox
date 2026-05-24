class MockDatabase {
  pragmaCalls: string[] = [];
  execCalls: string[] = [];
  data: Record<string, Record<string, unknown>[]> = {
    games: [],
    controller_profiles: [],
    console_layouts: [],
    settings: []
  };

  constructor(path: string) { void path; }

  pragma(str: string) {
    this.pragmaCalls.push(str);
  }

  exec(sql: string) {
    this.execCalls.push(sql);
  }

  transaction(fn: (...args: unknown[]) => unknown) {
    return (...args: unknown[]) => fn(...args);
  }

  prepare(sql: string) {
    const query = sql.replace(/\s+/g, ' ').trim();
    return {
      all: jest.fn().mockImplementation((...params: unknown[]) => {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return this.executeSelect(query, flatParams, false);
      }),
      get: jest.fn().mockImplementation((...params: unknown[]) => {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const results = this.executeSelect(query, flatParams, true);
        return results[0];
      }),
      run: jest.fn().mockImplementation((...params: unknown[]) => {
        const flatParams = params.length === 1 && (Array.isArray(params[0]) || typeof params[0] === 'object') ? [params[0]] : params;
        return this.executeUpdate(query, flatParams);
      }),
      close: jest.fn()
    };
  }

  executeSelect(query: string, params: unknown[], limitOne = false): Record<string, unknown>[] {
    const queryUpper = query.toUpperCase();

    if (queryUpper.includes('PRAGMA TABLE_INFO')) {
      const match = query.match(/table_info\(([^)]+)\)/i);
      const tableName = match ? match[1].trim() : 'games';
      if (tableName === 'games') {
        return [
          { name: 'id' },
          { name: 'title' },
          { name: 'filePath' },
          { name: 'consoleId' },
          { name: 'engineId' },
          { name: 'playtime_seconds' },
          { name: 'last_played_at' }
        ];
      }
      return [{ name: 'id' }];
    }
    
    if (queryUpper.includes('SELECT NAME FROM SQLITE_MASTER')) {
      return [
        { name: 'games' },
        { name: 'controller_profiles' },
        { name: 'console_layouts' },
        { name: 'settings' }
      ];
    }
    
    const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (!selectMatch) {
      return [];
    }
    
    const [, fieldsStr, tableName, whereStr, orderByStr, limitStr] = selectMatch;
    const table = this.data[tableName.toLowerCase()];
    if (!table) return [];
    
    let results = [...table];
    
    if (whereStr) {
      results = results.filter(row => {
        return this.evaluateWhere(whereStr, row, params);
      });
    }
    
    if (orderByStr) {
      const orders = orderByStr.split(',').map(o => o.trim());
      results.sort((a, b) => {
        for (const order of orders) {
          const parts = order.split(' ');
          const col = parts[0].trim();
          const dir = parts[1] ? parts[1].toUpperCase() : 'ASC';
          
          const valA = a[col];
          const valB = b[col];
          
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          
          if (dir === 'DESC') {
            return (valA as number | string) > (valB as number | string) ? -1 : 1;
          } else {
            return (valA as number | string) > (valB as number | string) ? 1 : -1;
          }
        }
        return 0;
      });
    }
    
    const limit = limitStr ? parseInt(limitStr, 10) : (limitOne ? 1 : null);
    if (limit !== null) {
      results = results.slice(0, limit);
    }

    if (queryUpper.includes('COUNT(*)')) {
      const aliasMatch = query.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
      const alias = aliasMatch ? aliasMatch[1] : 'count';
      return [{ [alias]: results.length }];
    }
    
    if (fieldsStr.trim() !== '*') {
      const fields = fieldsStr.split(',').map(f => f.trim().split(' ').pop());
      results = results.map(row => {
        const projected: Record<string, unknown> = {};
        for (const f of fields) {
          if (f) {
            projected[f] = row[f];
          }
        }
        return projected;
      });
    }
    
    return results;
  }

  evaluateWhere(whereStr: string, row: Record<string, unknown>, params: unknown[]): boolean {
    const conditions = whereStr.split(/\s+AND\s+/i);
    let paramIndex = 0;
    
    for (const condition of conditions) {
      const match = condition.trim().match(/(\w+)\s*(=|!=|LIKE|<|>)\s*(.*)/i);
      if (!match) continue;
      const [, col, op, valExpr] = match;
      
      const colVal = row[col];
      let filterVal: unknown;
      
      const expr = valExpr.trim();
      if (expr === '?') {
        filterVal = params[paramIndex++];
      } else if (expr.startsWith('@')) {
        const prop = expr.substring(1);
        filterVal = params[0] ? (params[0] as Record<string, unknown>)[prop] : undefined;
      } else {
        if (expr.startsWith("'") && expr.endsWith("'")) {
          filterVal = expr.slice(1, -1);
        } else if (expr.startsWith('"') && expr.endsWith('"')) {
          filterVal = expr.slice(1, -1);
        } else if (!isNaN(Number(expr))) {
          filterVal = Number(expr);
        } else {
          filterVal = expr;
        }
      }
      
      if (op === '=') {
        if (colVal != filterVal) return false;
      } else if (op === '!=') {
        if (colVal == filterVal) return false;
      }
    }
    
    return true;
  }

  executeUpdate(query: string, params: unknown[]): { changes: number } {
    const queryUpper = query.toUpperCase();
    
    if (queryUpper.startsWith('INSERT')) {
      const match = query.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!match) return { changes: 0 };
      
      const [, tableName, colsStr, valsStr] = match;
      const table = this.data[tableName.toLowerCase()];
      if (!table) return { changes: 0 };
      
      const cols = colsStr.split(',').map(c => c.trim());
      const valsExprs = valsStr.split(',').map(v => v.trim());
      
      const row: Record<string, unknown> = {};
      let paramIndex = 0;
      
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const expr = valsExprs[i];
        
        let val: unknown;
        if (expr === '?') {
          val = params[paramIndex++];
        } else if (expr.startsWith('@')) {
          const prop = expr.substring(1);
          val = params[0] ? (params[0] as Record<string, unknown>)[prop] : undefined;
        } else {
          if (expr.startsWith("'") && expr.endsWith("'")) {
            val = expr.slice(1, -1);
          } else if (expr.startsWith('"') && expr.endsWith('"')) {
            val = expr.slice(1, -1);
          } else if (!isNaN(Number(expr))) {
            val = Number(expr);
          } else {
            val = expr;
          }
        }
        
        row[col] = val;
      }
      
      if (tableName.toLowerCase() === 'controller_profiles' && row.is_default === 1) {
        const hasDefault = table.some(p => p.is_default === 1 && p.id !== row.id);
        if (hasDefault) {
          throw new Error('UNIQUE constraint failed: controller_profiles.is_default');
        }
      }
      
      const idCol = tableName.toLowerCase() === 'settings' ? 'key' : 'id';
      const existingIndex = table.findIndex(r => r[idCol] === row[idCol]);
      if (existingIndex >= 0) {
        if (queryUpper.includes('IGNORE')) {
          return { changes: 0 };
        }
        table[existingIndex] = { ...table[existingIndex], ...row };
      } else {
        table.push(row);
      }
      
      return { changes: 1 };
    }
    
    if (queryUpper.startsWith('UPDATE')) {
      const updateMatch = query.match(/UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*))?$/i);
      if (!updateMatch) return { changes: 0 };
      
      const [, tableName, setStr, whereStr] = updateMatch;
      const table = this.data[tableName.toLowerCase()];
      if (!table) return { changes: 0 };
      
      let rowsToUpdate = [...table];
      
      const sets = setStr.split(',').map(s => s.trim());
      let setParamCount = 0;
      for (const set of sets) {
        if (set.includes('?')) setParamCount++;
      }
      
      const setParams = params.slice(0, setParamCount);
      const whereParams = params.slice(setParamCount);
      
      if (whereStr) {
        rowsToUpdate = rowsToUpdate.filter(row => {
          return this.evaluateWhere(whereStr, row, whereParams);
        });
      }
      
      let changes = 0;
      for (const row of rowsToUpdate) {
        changes++;
        let setParamIndex = 0;
        
        for (const set of sets) {
          const setMatch = set.match(/(\w+)\s*=\s*(.*)/);
          if (!setMatch) continue;
          const [, col, expr] = setMatch;
          
          if (expr.includes('+')) {
            const addMatch = expr.match(/(\w+)\s*\+\s*(\?|\w+)/);
            if (addMatch) {
              const val = setParams[setParamIndex++] as number;
              row[col] = ((row[col] as number) ?? 0) + val;
            }
          } else {
            let val: unknown;
            if (expr === '?') {
              val = setParams[setParamIndex++];
            } else if (expr.startsWith('@')) {
              const prop = expr.substring(1);
              val = params[0] ? (params[0] as Record<string, unknown>)[prop] : undefined;
            } else {
              if (expr.startsWith("'") && expr.endsWith("'")) {
                val = expr.slice(1, -1);
              } else if (!isNaN(Number(expr))) {
                val = Number(expr);
              } else {
                val = expr;
              }
            }
            row[col] = val;
          }
        }
        
        if (tableName.toLowerCase() === 'controller_profiles' && row.is_default === 1) {
          for (const other of table) {
            if (other.id !== row.id) other.is_default = 0;
          }
        }
      }
      
      return { changes };
    }
    
    if (queryUpper.startsWith('DELETE')) {
      const deleteMatch = query.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?$/i);
      if (!deleteMatch) return { changes: 0 };
      
      const [, tableName, whereStr] = deleteMatch;
      const table = this.data[tableName.toLowerCase()];
      if (!table) return { changes: 0 };
      
      const lenBefore = table.length;
      if (whereStr) {
        this.data[tableName.toLowerCase()] = table.filter(row => {
          return !this.evaluateWhere(whereStr, row, params);
        });
      } else {
        this.data[tableName.toLowerCase()] = [];
      }
      
      return { changes: lenBefore - this.data[tableName.toLowerCase()].length };
    }
    
    return { changes: 0 };
  }

  close() { /* mock close */ }
}

const mockBetterSqlite3 = jest.fn().mockImplementation((path: string) => {
  return new MockDatabase(path);
});

(mockBetterSqlite3 as unknown as Record<string, unknown>).default = mockBetterSqlite3;

module.exports = mockBetterSqlite3;
export default mockBetterSqlite3;
