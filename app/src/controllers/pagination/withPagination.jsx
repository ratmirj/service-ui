import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { fetch, connectRouter } from 'common/utils';

const PAGE_KEY = 'page.page';
const SIZE_KEY = 'page.size';
const FILTER_KEY = 'filter.cnt.name';
const SORTING_KEY = 'page.sort';

export const withPagination = ({ url: staticURL } = {}) => (WrappedComponent) => {
  @connectRouter(
    (query) => ({
      page: query[PAGE_KEY] && Number(query[PAGE_KEY]),
      size: query[SIZE_KEY] && Number(query[SIZE_KEY]),
    }),
    {
      updatePagination: (page, size) => ({ [PAGE_KEY]: page, [SIZE_KEY]: size }),
    },
  )
  class PaginationWrapper extends PureComponent {
    static propTypes = {
      filter: PropTypes.string,
      page: PropTypes.number,
      size: PropTypes.number,
      url: PropTypes.string,
      updatePagination: PropTypes.func,
      sortingString: PropTypes.string,
    };

    static defaultProps = {
      url: staticURL,
      filter: null,
      page: 1,
      size: 20,
      sortingString: null,
      updatePagination: () => {},
    };

    state = {
      data: [],
      totalElements: 0,
      totalPages: 0,
    };

    componentDidMount() {
      const { page, size, url, sortingString } = this.props;
      this.fetchData(url, { page, size, sortingString });
    }

    componentWillReceiveProps({ url, page, size, filter, sortingString }) {
      if (
        url !== this.props.url ||
        page !== this.props.page ||
        size !== this.props.size ||
        filter !== this.props.filter ||
        sortingString !== this.props.sortingString
      ) {
        this.fetchData(url, { page, size, filter, sortingString });
      }
    }

    fetchData = (url, queryParams = {}) =>
      fetch(url || this.props.url, {
        params: {
          [PAGE_KEY]: queryParams.page,
          [SIZE_KEY]: queryParams.size,
          [FILTER_KEY]: queryParams.filter,
          [SORTING_KEY]: queryParams.sortingString,
        },
      }).then((result) => {
        const { totalElements, totalPages } = result.page;
        this.setState({
          totalElements,
          totalPages,
          data: result.content,
        });
      });

    fetchDataWithCurrentProps = () => {
      const { url, page, size, filter, sortingString } = this.props;
      return this.fetchData(url, { page, size, filter, sortingString });
    };

    changePageHandler = (page) => this.changePaginationOptions({ page });

    changeSizeHandler = (size) => this.changePaginationOptions({ size, page: 1 });

    changePaginationOptions = (options) => {
      const { page, size } = this.props;
      this.props.updatePagination(options.page || page, options.size || size);
    };

    render() {
      const { page, size, ...restProps } = this.props;
      return (
        <WrappedComponent
          data={this.state.data}
          activePage={this.props.page}
          itemCount={this.state.totalElements}
          pageCount={this.state.totalPages}
          pageSize={this.props.size}
          onChangePage={this.changePageHandler}
          onChangePageSize={this.changeSizeHandler}
          fetchData={this.fetchDataWithCurrentProps}
          {...restProps}
        />
      );
    }
  }

  return PaginationWrapper;
};
