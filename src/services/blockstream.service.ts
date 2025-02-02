/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  EstimateFeeResponse,
  FormattedUTXO,
  TransactionDetails,
  UTXO,
} from 'src/common/interfaces';
import { Address, Script } from 'bitcore-lib';

import axios from 'axios';

@Injectable()
export class BlockstreamService {
  private readonly baseUrl: string;
  constructor() {
    this.baseUrl = `${process.env.BLOCKSTREAM_BASE_URL}${process.env.BITCOIN_NETWORK === 'mainnet' ? 'api' : 'testnet/api'}`;
  }

  async getUtxos(address: string): Promise<UTXO[]> {
    const url = `${this.baseUrl}/address/${address}/utxo`;
    const response = await axios.get<UTXO[]>(url);
    return response.data;
  }

  async getEstimateFee(): Promise<EstimateFeeResponse> {
    const url = `${this.baseUrl}/fee-estimates`;
    const response = await axios.get<EstimateFeeResponse>(url);
    return response.data;
  }

  async getTransactions(address: string): Promise<TransactionDetails[]> {
    const url = `${this.baseUrl}/address/${address}/txs`;
    const response = await axios.get<TransactionDetails[]>(url);
    return response.data;
  }

  async getTransactionDetails(txId: string): Promise<TransactionDetails> {
    const url = `${this.baseUrl}/tx/${txId}`;
    const response = await axios.get<TransactionDetails>(url);
    return response.data;
  }

  async broadcastTransaction(serializedTx: string): Promise<string> {
    const url = `${this.baseUrl}/tx`;
    const response = await axios.post(url, serializedTx, {
      headers: { 'Content-Type': 'text/plain' },
    });

    return response.data;
  }

  async getFormattedUtxos(
    address: string,
  ): Promise<FormattedUTXO[] | undefined> {
    const utxos = await this.getUtxos(address);

    if (!utxos || utxos.length === 0) {
      return;
    }

    const transactionsMap: Record<string, any> = {};

    const formattedUtxos: FormattedUTXO[] = await Promise.all(
      utxos.map(async (utxo): Promise<FormattedUTXO> => {
        if (!transactionsMap[utxo.txid]) {
          transactionsMap[utxo.txid] = await this.getTransactionDetails(
            utxo.txid,
          );
        }

        const txDetails = transactionsMap[utxo.txid];
        const scriptPubKey = txDetails.vout[utxo.vout].scriptpubkey;
        const addressStr = txDetails.vout[utxo.vout].scriptpubkey_address;

        return {
          txId: utxo.txid,
          outputIndex: utxo.vout,
          script: new Script(scriptPubKey),
          satoshis: utxo.value,
          address: new Address(addressStr),
          inspect: function () {
            return JSON.stringify(this, null, 2);
          },
          toObject: function () {
            return {
              txId: this.txId,
              outputIndex: this.outputIndex,
              script: this.script.toString(),
              satoshis: this.satoshis,
              address: this.address?.toString() || '',
            };
          },
        };
      }),
    );

    return formattedUtxos;
  }
}
