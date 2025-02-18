import { DataSource } from 'apollo-datasource';
import { ApolloError } from 'apollo-server';
import AWS from 'aws-sdk';
import { LocationQueryInput, LocationQueryOutput } from '../../fetch-location-lambda/types';
import { ErrorCodes } from '../enums/error-codes';

export const fetchLocationInfoFailedErrorMessage =
	'[LocationDataSource] - An error occurred while trying to fetch location information from MapBox API.';

export class LocationDataSource extends DataSource {
	functionName = 'fetch_location'; // TODO: put this in an env. variable, so that this class and terraform can use it from the same place

	constructor(private lambda: AWS.Lambda) {
		super();
	}

	fetchLocationInfo(input: string): Promise<LocationQueryOutput> {
		return new Promise<LocationQueryOutput>((resolve, reject) => {
			const locationQueryInput: LocationQueryInput = {
				value: input,
			};

			console.log(`[LocationDataSource] - Fetching location info for input "${input}".`);

			this.lambda.invoke(
				{
					FunctionName: this.functionName,
					Payload: JSON.stringify(locationQueryInput),
				},
				(err, lambdaResponse) => {
					if (err) {
						const apolloError = new ApolloError(
							fetchLocationInfoFailedErrorMessage,
							ErrorCodes.FETCH_LOCATION_INFO_FAILED,
							err,
						);
						console.error(apolloError);
						reject(apolloError);
					} else {
						// When present, the property FunctionError indicates that an error occurred while the lambda was executing.
						if (lambdaResponse.FunctionError) {
							// If FunctionError is present, the original error will be in the Payload; parse it and throw it inside an ApolloError.
							const apolloError = new ApolloError(
								fetchLocationInfoFailedErrorMessage,
								ErrorCodes.FETCH_LOCATION_INFO_FAILED,
								JSON.parse(lambdaResponse.Payload as string),
							);
							console.error(apolloError);
							reject(apolloError);
							return;
						}

						// If no errors occurred during the execution of the lambda, the results will be in the Payload; parse it and return it.

						// (Casting Payload to string since we know that the result will come serialized as string from FetchLocationLambda.
						// If something unexpected happens, we are going to catch the exception anyways)
						const result = JSON.parse(lambdaResponse.Payload as string);
						console.log(`[LocationDataSource] - Finished fetching location info for the input "${input}".`);
						resolve(result);
					}
				},
			);
		});
	}
}

export default LocationDataSource;
